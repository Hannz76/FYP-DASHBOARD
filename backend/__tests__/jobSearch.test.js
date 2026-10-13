import { jest } from "@jest/globals";
import { searchJobsFromProvider } from "../services/jobSearch.service.js";

const originalKey = process.env.JSEARCH_API_KEY;
let fetchMock;
beforeEach(() => {
  process.env.JSEARCH_API_KEY = "test-key";
  fetchMock = jest.spyOn(globalThis, "fetch");
});
afterEach(() => {
  fetchMock.mockRestore();
  if (originalKey === undefined) delete process.env.JSEARCH_API_KEY;
  else process.env.JSEARCH_API_KEY = originalKey;
});

it("uses the Malaysian provider filters and returns safe, deduplicated listings", async () => {
  const job = { job_id: "job-1", job_title: "Welder", employer_name: "Example", job_city: "Kerteh", job_apply_link: "https://example.com/apply", job_min_salary: 1200, job_salary_currency: "MYR", job_salary_period: "MONTH", job_publisher: "Example Jobs" };
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: [job, job, { ...job, job_id: "bad", job_apply_link: "javascript:alert(1)" }], cursor: "next-page" } }) });
  const result = await searchJobsFromProvider({ q: "Welder", location: "Terengganu", employmentType: "INTERN" });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin + url.pathname).toBe("https://api.openwebninja.com/jsearch/search-v2");
  expect(url.searchParams.get("query")).toBe("Welder in Terengganu");
  expect(url.searchParams.get("employment_types")).toBe("INTERN");
  expect(url.searchParams.get("country")).toBe("my");
  expect(options.headers).toEqual({ "x-api-key": "test-key" });
  expect(result.jobs).toHaveLength(1);
  expect(result.jobs[0]).toMatchObject({ title: "Welder", salary: "RM 1,200+ / MONTH", source: "Example Jobs", applyLink: "https://example.com/apply" });
});

it("does not call the provider without a key", async () => {
  delete process.env.JSEARCH_API_KEY;
  expect((await searchJobsFromProvider({ q: "IT Support" })).warning).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["http", "network", "malformed"])("reports a %s failure without exposing provider details", async (failure) => {
  if (failure === "network") fetchMock.mockRejectedValue(new Error("secret provider information"));
  else fetchMock.mockResolvedValue({ ok: failure !== "http", json: async () => ({ error: "secret provider information" }) });
  const result = await searchJobsFromProvider({ q: "Welder" });
  expect(result.jobs).toEqual([]);
  expect(result.warning).toBeTruthy();
  expect(result.warning).not.toContain("secret");
});

it("returns at most six jobs and does not invent an allowance", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: Array.from({ length: 9 }, (_, i) => ({ job_id: String(i), job_title: "Intern", job_apply_link: `https://example.com/${i}` })) } }) });
  const { jobs } = await searchJobsFromProvider({ q: "Intern" });
  expect(jobs).toHaveLength(6);
  expect(jobs[0].salary).toBe("Gaji / elaun tidak dinyatakan");
});

it("uses the provider's formatted salary and location", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: [{ job_id: "formatted", job_title: "IT Support", job_apply_link: "https://example.com/apply", job_location: "Cyberjaya, Selangor", job_salary_string: "RM 1,000–1,500 a month" }] } }) });
  const { jobs } = await searchJobsFromProvider({ q: "IT Support" });
  expect(jobs[0]).toMatchObject({ location: "Cyberjaya, Selangor", salary: "RM 1,000–1,500 a month" });
});

it("accepts a successful empty v2 response without a warning", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "OK", data: { jobs: [], cursor: null } }) });
  expect(await searchJobsFromProvider({ q: "Intern" })).toEqual({ jobs: [] });
});
