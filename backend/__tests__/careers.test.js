import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { CareerError } from "../utils/careerCache.js";

process.env.JWT_SECRET = "career-tests-only-signing-secret";

jest.unstable_mockModule("../services/careerCache.service.js", () => ({ careerCache: { search: jest.fn(), history: jest.fn(), details: jest.fn() } }));
const { careerCache } = await import("../services/careerCache.service.js");
const { default: app } = await import("../server.js");
const { default: Student } = await import("../models/Student.js");
let studentFind;
let sequence = 0;
let email;
const student = { _id: "db-id", ID_Pelajar: "S1", Kursus: "ITW", CGPA: "3", Kehadiran_Pct: "90" };
const jobs = [{ jobId: "J1", title: "Welder Intern", applyLink: "https://example.com/apply" }];
function token(role = "user", studentId = "S1") {
  return jwt.sign({ email, role, studentId }, process.env.JWT_SECRET);
}
const get = (path, role = "user", id = "S1") => request(app).get(path).set("Authorization", `Bearer ${token(role, id)}`);

beforeEach(() => {
  email = `career-test-${sequence++}@example.com`;
  studentFind = jest.spyOn(Student, "findOne").mockResolvedValue({ ...student });
  careerCache.search.mockReset().mockResolvedValue({ jobs, cursor: "page2", cached: true, resetAt: Date.now() + 10000 });
  careerCache.history.mockReset().mockResolvedValue({ keywords: ["welder"], resetAt: Date.now() + 10000 });
  careerCache.details.mockReset().mockResolvedValue({ job: { ...jobs[0], description: "Job description" }, cached: true, resetAt: Date.now() + 10000 });
});
afterEach(() => jest.restoreAllMocks());

it.each(["/search?q=Welder", "/history", "/job-details?job_id=J1", "/pathways/S1"])("requires authentication for %s", async (path) => {
  expect((await request(app).get(`/api/careers${path}`)).status).toBe(401);
});

it.each(["/search?q=Welder&department=DFK", "/history/DFK", "/history?studentId=S2", "/job-details?job_id=J1&department=DFK", "/pathways/S2"])("denies department/ownership spoofing at %s", async (path) => {
  expect((await get(`/api/careers${path}`)).status).toBe(403);
  expect(careerCache.search).not.toHaveBeenCalled();
  expect(careerCache.history).not.toHaveBeenCalled();
  expect(careerCache.details).not.toHaveBeenCalled();
});

it("denies unlinked students and unsupported roles without calling the cache", async () => {
  expect((await get("/api/careers/search?q=Welder", "user", null)).status).toBe(403);
  expect((await get("/api/careers/history", "guest")).status).toBe(403);
  expect(careerCache.search).not.toHaveBeenCalled();
});

it.each(["ITW", "DFK", "DGA", "SLR", "DCG", "SED", "PPU"])("derives %s department from MongoDB", async (department) => {
  studentFind.mockResolvedValue({ ...student, Kursus: ` ${department.toLowerCase()}* ` });
  const res = await get("/api/careers/search?q=Intern");
  expect(res.body.department).toBe(department);
  expect(careerCache.search.mock.calls[0][0]).toBe(department);
  expect(studentFind).toHaveBeenCalledWith({ ID_Pelajar: "S1" });
});

it.each(["admin", "counselor"])("allows explicit %s department and student selection", async (role) => {
  expect((await get("/api/careers/search?q=Intern&department=DFK", role, null)).body.department).toBe("DFK");
  expect((await get("/api/careers/history?studentId=S1", role, null)).body.department).toBe("ITW");
  expect((await get("/api/careers/search?q=Intern", role, null)).status).toBe(400);
});

it.each(["", "?q=", "?q=Welder&employmentType=CEO", "?q=a&q=b", "?q=Welder&location=", "?q=Welder&num_pages=20", "?q=Welder&unknown=true"])("rejects invalid search %s", async (query) => {
  expect((await get(`/api/careers/search${query}`)).status).toBe(400);
  expect(careerCache.search).not.toHaveBeenCalled();
});

it("preserves complete filters/cursor and returns no-store responses", async () => {
  const res = await get("/api/careers/search?query=IT%20Support&country=my&date_posted=week&cursor=AbC%2B%2F%3D&work_from_home=true");
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, jobs, cursor: "page2" });
  expect(careerCache.search.mock.calls[0][1]).toMatchObject({ query: "it support", country: "my", date_posted: "week", cursor: "AbC+/=", work_from_home: "true" });
  expect(res.headers["cache-control"]).toBe("private, no-store");
});

it("returns shared keywords scoped to the current department", async () => {
  const res = await get("/api/careers/history");
  expect(res.body).toMatchObject({ department: "ITW", keywords: ["welder"] });
  expect(careerCache.history).toHaveBeenCalledWith("ITW");
});

it("loads global details by one job ID and rejects batching/variant parameters", async () => {
  expect((await get("/api/careers/job-details?job_id=J1")).body.job.description).toBe("Job description");
  expect(careerCache.details).toHaveBeenCalledWith("J1");
  expect((await get("/api/careers/job-details?job_id=J1,J2")).status).toBe(400);
  expect((await get("/api/careers/job-details?job_id=J1&language=fr")).status).toBe(400);
});

it("shares provider failures and Retry-After without overwriting the pathway", async () => {
  careerCache.search.mockRejectedValue(new CareerError("Rate limited", 429, "PROVIDER_RATE_LIMIT", 30));
  const res = await get("/api/careers/search?q=Welder");
  expect(res.status).toBe(429);
  expect(res.headers["retry-after"]).toBe("30");
  const pathway = await get("/api/careers/pathways/S1");
  expect(pathway.body.pathway.targetRoles).toContain("Welder / Fabricator");
  expect(pathway.body.warning).toBe("Rate limited");
});

it("ignores the legacy student cache and always uses department caching", async () => {
  studentFind.mockResolvedValue({ ...student, careerCache: { pathway: { courseCode: "ITW" }, recommendedJobs: [], fetchedAt: new Date() } });
  const res = await get("/api/careers/pathways/S1");
  expect(res.body.jobs).toEqual(jobs);
  expect(careerCache.search).toHaveBeenCalledTimes(1);
});

it("rejects missing student records and invalid departments", async () => {
  studentFind.mockResolvedValue(null);
  expect((await get("/api/careers/search?q=Intern")).status).toBe(404);
  studentFind.mockResolvedValue({ ...student, Kursus: "UNKNOWN" });
  expect((await get("/api/careers/search?q=Intern")).status).toBe(403);
});

it("rate limits by authenticated account", async () => {
  for (let i = 0; i < 20; i++) expect((await get("/api/careers/search?q=Welder")).status).toBe(200);
  expect((await get("/api/careers/search?q=Welder")).status).toBe(429);
  email = "another-student@example.com";
  expect((await get("/api/careers/search?q=Welder")).status).toBe(200);
});
