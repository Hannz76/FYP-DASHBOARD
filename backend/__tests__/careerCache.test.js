import { buildSearchCacheKey, getDailyCacheWindow, parseSearchParameters, secondsUntilNextEight } from "../utils/careerCache.js";

it.each([
  ["2026-10-13T07:59:59+08:00", "2026-10-13T08:00:00+08:00", 1],
  ["2026-10-13T08:00:00+08:00", "2026-10-14T08:00:00+08:00", 86400],
  ["2026-10-13T23:59:00+08:00", "2026-10-14T08:00:00+08:00", 28860],
])("resets %s at the next Malaysia 08:00", (now, reset, ttl) => {
  expect(getDailyCacheWindow(Date.parse(now))).toEqual({ expiresAt: Date.parse(reset), ttlSeconds: ttl });
  expect(secondsUntilNextEight(Date.parse(now))).toBe(ttl);
});

it("sorts all parameter keys and separates every provider option and department", () => {
  const base = parseSearchParameters({ q: " Cloud  Support " }).params;
  const key = buildSearchCacheKey("DFK", base);
  expect(buildSearchCacheKey("DFK", Object.fromEntries(Object.entries(base).reverse()))).toBe(key);
  expect(buildSearchCacheKey("ITW", base)).not.toBe(key);
  for (const [name, value] of Object.entries({ query: "welder", country: "sg", date_posted: "week", cursor: "AbC+/=", language: "en", work_from_home: "true", employment_types: "FULLTIME", job_requirements: "no_experience", radius: "20", exclude_job_publishers: "Indeed", fields: "job_id,job_title" })) {
    expect(buildSearchCacheKey("DFK", { ...base, [name]: value })).not.toBe(key);
  }
});

it("shares equivalent defaults and keeps opaque pagination cursors unchanged", () => {
  const first = parseSearchParameters({ q: "Cloud Support", employmentType: "INTERN" });
  const equivalent = parseSearchParameters({ query: "cloud support in malaysia", country: "MY", date_posted: "all", employment_types: "INTERN", work_from_home: "false", num_pages: "1" });
  expect(first.params).toEqual(equivalent.params);
  expect(parseSearchParameters({ query: "support", cursor: "AbC+/=" }).params.cursor).toBe("AbC+/=");
});

it("adds mandatory card fields to the exact projection sent to the provider", () => {
  const { params } = parseSearchParameters({ q: "Intern", fields: "employer_name,job_id" });
  expect(params.fields).toBe("employer_name,job_apply_link,job_id,job_title");
  const same = parseSearchParameters({ q: "Intern", fields: "job_title,employer_name,job_apply_link,job_id" });
  expect(buildSearchCacheKey("DFK", params)).toBe(buildSearchCacheKey("DFK", same.params));
});

it.each([{ q: ["one", "two"] }, { q: "job", cursor: ["a", "b"] }, { q: "job", date_posted: "invalid" }, { q: "job", num_pages: "20" }, { query: "job", q: "job" }, { q: "job", unexpected: "value" }])("rejects ambiguous or expensive input %j", (input) => {
  expect(() => parseSearchParameters(input)).toThrow();
});
