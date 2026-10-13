import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../services/jobSearch.service.js", () => ({ searchJobsFromProvider: jest.fn() }));
const { searchJobsFromProvider } = await import("../services/jobSearch.service.js");
const { default: app } = await import("../server.js");
const { default: Student } = await import("../models/Student.js");
const { default: JobSearchCache } = await import("../models/JobSearchCache.js");
let studentFind, studentUpdate, cacheFind, cacheWrite;
let sequence = 0;
let email;
const student = { _id: "db-id", ID_Pelajar: "S1", Kursus: "ITW", CGPA: "3", Kehadiran_Pct: "90" };
const jobs = [{ jobId: "J1", title: "Welder Intern", applyLink: "https://example.com/apply" }];
function token(role = "user", studentId = "S1") {
  return jwt.sign({ email, role, studentId }, process.env.JWT_SECRET || "");
}
const get = (path, role = "user", id = "S1") => request(app).get(path).set("Authorization", `Bearer ${token(role, id)}`);

beforeEach(() => {
  email = `career-test-${sequence++}@example.com`;
  studentFind = jest.spyOn(Student, "findOne").mockResolvedValue({ ...student });
  studentUpdate = jest.spyOn(Student, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  cacheFind = jest.spyOn(JobSearchCache, "findOne").mockResolvedValue(null);
  cacheWrite = jest.spyOn(JobSearchCache, "findOneAndUpdate").mockResolvedValue({});
  searchJobsFromProvider.mockReset().mockResolvedValue({ jobs });
});
afterEach(() => jest.restoreAllMocks());

it("requires authentication on both endpoints", async () => {
  expect((await request(app).get("/api/careers/search?q=Welder")).status).toBe(401);
  expect((await request(app).get("/api/careers/pathways/S1")).status).toBe(401);
});

it("denies another student's pathway and an unlinked student", async () => {
  expect((await get("/api/careers/pathways/S2")).status).toBe(403);
  expect((await get("/api/careers/pathways/S1", "user", null)).status).toBe(403);
  expect(studentFind).not.toHaveBeenCalled();
});

it.each(["user", "admin", "counselor"])("allows authorized %s pathway requests", async (role) => {
  const res = await get("/api/careers/pathways/S1", role, role === "user" ? "S1" : null);
  expect(res.status).toBe(200);
  expect(res.body.pathway.targetRoles).toContain("Welder / Fabricator");
  expect(res.body.jobs).toEqual(jobs);
  expect(res.headers["cache-control"]).toBe("private, no-store");
});

it("returns 404 for a missing student", async () => {
  studentFind.mockResolvedValue(null);
  expect((await get("/api/careers/pathways/S1")).status).toBe(404);
});

it.each(["", "?q=", "?q=Welder&employmentType=CEO", "?q=a&q=b", "?q=Welder&location="])("rejects invalid manual input %s", async (query) => {
  expect((await get(`/api/careers/search${query}`)).status).toBe(400);
  expect(searchJobsFromProvider).not.toHaveBeenCalled();
});

it("normalizes equivalent searches, checks freshness and shares results", async () => {
  const first = await get("/api/careers/search?q=%20Welder%20%20Intern%20");
  expect(first.body).toMatchObject({ success: true, cached: false, jobs });
  expect(searchJobsFromProvider).toHaveBeenCalledWith({ q: "welder intern", location: "malaysia", employmentType: "INTERN" });
  const firstKey = cacheFind.mock.calls[0][0].cacheKey;
  const cutoff = cacheFind.mock.calls[0][0].createdAt.$gt.getTime();
  expect(Math.abs(cutoff - (Date.now() - 86400000))).toBeLessThan(2000);
  cacheFind.mockResolvedValue({ jobs });
  const second = await get("/api/careers/search?q=welder%20intern&location=Malaysia&employmentType=INTERN");
  expect(second.body.cached).toBe(true);
  expect(cacheFind.mock.calls[1][0].cacheKey).toBe(firstKey);
  expect(searchJobsFromProvider).toHaveBeenCalledTimes(1);
});

it("returns a pathway when the provider is unavailable without poisoning caches", async () => {
  searchJobsFromProvider.mockResolvedValue({ jobs: [], warning: "Temporarily unavailable" });
  const res = await get("/api/careers/pathways/S1");
  expect(res.status).toBe(200);
  expect(res.body.pathway.actionPlan.length).toBeGreaterThan(0);
  expect(res.body.warning).toBe("Temporarily unavailable");
  expect(cacheWrite).not.toHaveBeenCalled();
  expect(studentUpdate).not.toHaveBeenCalled();
  expect((await get("/api/careers/search?q=Welder")).status).toBe(503);
});

it("reuses recent student jobs but recalculates readiness from current grades", async () => {
  studentFind.mockResolvedValue({ ...student, careerCache: { pathway: { courseCode: "ITW", readinessScore: 100 }, recommendedJobs: jobs, fetchedAt: new Date() } });
  const res = await get("/api/careers/pathways/S1");
  expect(res.body.cached).toBe(true);
  expect(res.body.pathway.readinessScore).toBe(50);
  expect(searchJobsFromProvider).not.toHaveBeenCalled();
});

it.each(["expired", "changed-course"])("refreshes a %s student cache", async (scenario) => {
  studentFind.mockResolvedValue({ ...student, careerCache: { pathway: { courseCode: scenario === "changed-course" ? "DFK" : "ITW" }, recommendedJobs: [], fetchedAt: new Date(Date.now() - (scenario === "expired" ? 3600001 : 0)) } });
  expect((await get("/api/careers/pathways/S1")).body.jobs).toEqual(jobs);
  expect(searchJobsFromProvider).toHaveBeenCalledTimes(1);
});

it("rate limits by authenticated account", async () => {
  cacheFind.mockResolvedValue({ jobs });
  for (let i = 0; i < 10; i++) expect((await get("/api/careers/search?q=Welder")).status).toBe(200);
  expect((await get("/api/careers/search?q=Welder")).status).toBe(429);
  email = "another-student@example.com";
  expect((await get("/api/careers/search?q=Welder")).status).toBe(200);
});
