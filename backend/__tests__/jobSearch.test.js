import { jest } from "@jest/globals";
import { searchJobsFromProvider, getJobDetailsFromProvider } from "../services/jobSearch.service.js";
import { parseSearchParameters } from "../utils/careerCache.js";

const originalKey = process.env.JSEARCH_API_KEY;
let fetchMock;
const job = { job_id: "J1", job_title: "Welder", employer_name: "Example", job_city: "Kerteh", job_apply_link: "https://example.com/apply", job_min_salary: 1200, job_salary_currency: "MYR", job_salary_period: "MONTH", job_publisher: "Example Jobs" };
const params = parseSearchParameters({ q: "Welder", location: "Terengganu" }).params;
beforeEach(() => {
  process.env.JSEARCH_API_KEY = "test-key";
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => {
  fetchMock.mockRestore();
  if (originalKey === undefined) delete process.env.JSEARCH_API_KEY;
  else process.env.JSEARCH_API_KEY = originalKey;
});

it("sends exactly the effective parameters and returns safe unique cards plus cursor", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: [job, job, { ...job, job_id: "bad", job_apply_link: "javascript:alert(1)" }], cursor: "next-page" } }) });
  const result = await searchJobsFromProvider(params);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin + url.pathname).toBe("https://api.openwebninja.com/jsearch/search-v2");
  expect(Object.fromEntries(url.searchParams)).toEqual(params);
  expect(options.headers).toEqual({ "x-api-key": "test-key" });
  expect(result).toMatchObject({ cursor: "next-page", jobs: [{ title: "Welder", salary: "RM 1,200+ / MONTH" }] });
});

it("does not call the provider without a key", async () => {
  delete process.env.JSEARCH_API_KEY;
  await expect(searchJobsFromProvider(params)).rejects.toMatchObject({ code: "API_KEY_MISSING" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["http", "network", "malformed"])("reports %s failure without exposing provider details", async (failure) => {
  if (failure === "network") fetchMock.mockRejectedValue(new Error("secret provider information"));
  else fetchMock.mockResolvedValue({ ok: failure !== "http", json: async () => ({ error: "secret provider information" }) });
  await expect(searchJobsFromProvider(params)).rejects.toMatchObject({ status: 503 });
  await expect(searchJobsFromProvider(params)).rejects.not.toThrow("secret");
});

it("keeps the whole page without inventing salary information", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: Array.from({ length: 10 }, (_, i) => ({ job_id: String(i), job_title: "Intern", job_apply_link: `https://example.com/${i}` })) } }) });
  const { jobs } = await searchJobsFromProvider(params);
  expect(jobs).toHaveLength(10);
  expect(jobs[0].salary).toBe("Gaji / elaun tidak dinyatakan");
});

it("accepts empty pages and stops repeated provider cursors", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: [], cursor: "same" } }) });
  expect(await searchJobsFromProvider({ ...params, cursor: "same" })).toEqual({ jobs: [], cursor: null });
});

it("preserves Retry-After on 429 without automatic retries", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 429, headers: new Headers({ "Retry-After": "45" }) });
  await expect(searchJobsFromProvider(params)).rejects.toMatchObject({ status: 429, code: "PROVIDER_RATE_LIMIT", retryAfter: 45 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("retrieves normalized global details for one ID", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: [{ ...job, job_description: "Work with the welding team." }] }) });
  expect((await getJobDetailsFromProvider("J1")).job.description).toBe("Work with the welding team.");
  const [url] = fetchMock.mock.calls[0];
  expect(url.pathname).toBe("/jsearch/job-details");
  expect(Object.fromEntries(url.searchParams)).toEqual({ job_id: "J1", country: "my", language: "en" });
});
