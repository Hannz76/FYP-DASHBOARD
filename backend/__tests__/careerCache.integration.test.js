import { jest } from "@jest/globals";
import { createClient } from "redis";
import { setTimeout as delay } from "node:timers/promises";
import { createCareerCache } from "../services/careerCache.service.js";
import { CareerError, buildSearchCacheKey, getDailyCacheWindow, parseSearchParameters } from "../utils/careerCache.js";

const suite = process.env.CAREER_TEST_REDIS_URL ? describe : describe.skip;
suite("career cache with a real disposable Redis database", () => {
  let redis, otherRedis, search, details, cache, otherCache;
  const page = { jobs: [{ jobId: "J1", title: "Welder" }], cursor: "next-page" };
  const params = parseSearchParameters({ q: "Welder" }).params;
  beforeAll(async () => {
    const url = new URL(process.env.CAREER_TEST_REDIS_URL);
    if (url.pathname !== "/15") throw new Error("Use an isolated Redis instance with test database /15.");
    redis = createClient({ url: url.href });
    otherRedis = createClient({ url: url.href });
    await Promise.all([redis.connect(), otherRedis.connect()]);
  });
  afterAll(async () => { await Promise.all([redis?.quit(), otherRedis?.quit()]); });
  beforeEach(async () => {
    await redis.flushDb();
    search = jest.fn(async () => page);
    details = jest.fn(async () => ({ job: { jobId: "J1", title: "Welder", description: "Job description" } }));
    cache = createCareerCache({ client: async () => redis, search, details });
    otherCache = createCareerCache({ client: async () => otherRedis, search, details });
  });

  it("shares department results across service instances and protects concurrent misses", async () => {
    search.mockImplementation(async () => { await delay(80); return page; });
    const results = await Promise.all([cache.search("ITW", params, "welder"), otherCache.search("ITW", params, "welder"), cache.search("ITW", params, "welder")]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.jobs[0].title === "Welder")).toBe(true);
    expect(results.filter((result) => !result.cached)).toHaveLength(1);
    await otherCache.search("DFK", params, "welder");
    expect(search).toHaveBeenCalledTimes(2);
    expect((await cache.history("PPU")).keywords).toEqual([]);
  });

  it("caches each complete cursor/filter combination separately", async () => {
    await cache.search("ITW", params);
    await cache.search("ITW", { ...params, cursor: "next-page" });
    await cache.search("ITW", { ...params, date_posted: "week" });
    const hit = await otherCache.search("ITW", { ...params, cursor: "next-page" });
    expect(hit.cursor).toBe("next-page");
    expect(hit.cached).toBe(true);
    expect(search).toHaveBeenCalledTimes(3);
  });

  it("keeps exactly ten unique recent keywords and moves a cache hit to the front", async () => {
    await Promise.all(Array.from({ length: 12 }, (_, i) => cache.search("ITW", { ...params, query: `keyword${i}` }, `keyword${i}`)));
    const history = await cache.history("ITW");
    expect(history.keywords).toHaveLength(10);
    expect(new Set(history.keywords).size).toBe(10);
    const repeated = history.keywords[9];
    await otherCache.search("ITW", { ...params, query: repeated }, repeated);
    expect((await cache.history("ITW")).keywords).toEqual([repeated, ...history.keywords.filter((keyword) => keyword !== repeated)]);
    expect((await cache.history("DFK")).keywords).toEqual([]);
    expect(search).toHaveBeenCalledTimes(12);
  });

  it("uses global details across departments without writing history", async () => {
    expect((await cache.details("J1")).cached).toBe(false);
    expect((await otherCache.details("J1")).cached).toBe(true);
    expect(details).toHaveBeenCalledTimes(1);
    expect((await cache.history("ITW")).keywords).toEqual([]);
    expect(Number(await redis.sendCommand(["PEXPIRETIME", "job_details:J1"]))).toBe(getDailyCacheWindow().expiresAt);
  });

  it("sets exact absolute expiration for results and history", async () => {
    const result = await cache.search("ITW", params, "welder");
    const expected = getDailyCacheWindow().expiresAt;
    expect(result.resetAt).toBe(expected);
    expect(Number(await redis.sendCommand(["PEXPIRETIME", buildSearchCacheKey("ITW", params)]))).toBe(expected);
    expect(Number(await redis.sendCommand(["PEXPIRETIME", "job_history:ITW"]))).toBe(expected);
  });

  it("expires real results/history and rejects a publisher crossing the boundary", async () => {
    let deadline = Date.now() + 600;
    const shortWindow = () => ({ expiresAt: deadline });
    const shortCache = createCareerCache({ client: async () => redis, search, windowFor: shortWindow });
    await shortCache.search("ITW", params, "welder");
    await delay(650);
    expect(await redis.get(buildSearchCacheKey("ITW", params))).toBeNull();
    expect(await redis.lRange("job_history:ITW", 0, -1)).toEqual([]);
    deadline = Date.now() + 100;
    search.mockImplementation(async () => { await delay(150); return page; });
    await expect(shortCache.search("ITW", params, "old keyword")).rejects.toMatchObject({ code: "DAILY_RESET" });
    expect(await redis.get(buildSearchCacheKey("ITW", params))).toBeNull();
    expect(await redis.lRange("job_history:ITW", 0, -1)).toEqual([]);
  });

  it("propagates failures to waiters without caching empty success or history", async () => {
    search.mockImplementation(async () => { await delay(80); throw new CareerError("Provider unavailable", 503, "PROVIDER_UNAVAILABLE", 5); });
    const failures = await Promise.allSettled([cache.search("ITW", params, "welder"), otherCache.search("ITW", params, "welder")]);
    expect(failures.every((result) => result.status === "rejected" && result.reason.code === "PROVIDER_UNAVAILABLE")).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(await redis.get(buildSearchCacheKey("ITW", params))).toBeNull();
    expect((await cache.history("ITW")).keywords).toEqual([]);
  });

  it("uses a global provider cooldown while allowing existing cache hits", async () => {
    await cache.search("ITW", params);
    search.mockRejectedValue(new CareerError("Rate limit", 429, "PROVIDER_RATE_LIMIT", 30));
    await expect(cache.search("DFK", params)).rejects.toMatchObject({ status: 429 });
    await expect(otherCache.search("PPU", params)).rejects.toMatchObject({ status: 429 });
    expect((await cache.search("ITW", params)).cached).toBe(true);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("never calls the provider when Redis is unavailable", async () => {
    const unavailable = createCareerCache({ client: async () => { throw new Error("offline"); }, search });
    await expect(unavailable.search("ITW", params)).rejects.toMatchObject({ code: "CACHE_UNAVAILABLE" });
    expect(search).not.toHaveBeenCalled();
  });

  it("cannot shorten a provider cooldown when concurrent misses return different limits", async () => {
    search.mockImplementation(async (request) => {
      const short = request.query === "short cooldown";
      await delay(short ? 100 : 30);
      throw new CareerError("Rate limit", 429, "PROVIDER_RATE_LIMIT", short ? 1 : 300);
    });
    const responses = await Promise.allSettled([
      cache.search("ITW", { ...params, query: "long cooldown" }),
      otherCache.search("DFK", { ...params, query: "short cooldown" }),
    ]);
    expect(responses.every((result) => result.status === "rejected")).toBe(true);
    expect(search).toHaveBeenCalledTimes(2);
    expect(await redis.pTTL("jsearch:cooldown")).toBeGreaterThan(299000);
  });

  it("rejects an obsolete lock owner without overwriting newer work", async () => {
    search.mockImplementation(async () => {
      await redis.set(`job_lock:${buildSearchCacheKey("ITW", params)}`, "another-owner", { expiration: { type: "PX", value: 30000 } });
      return page;
    });
    await expect(cache.search("ITW", params, "welder")).rejects.toMatchObject({ code: "CACHE_OWNER_LOST" });
    expect(await redis.get(buildSearchCacheKey("ITW", params))).toBeNull();
    expect(await redis.get(`job_lock:${buildSearchCacheKey("ITW", params)}`)).toBe("another-owner");
  });
});
