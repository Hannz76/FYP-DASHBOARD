import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../server.js";
import Student from "../models/Student.js";
import SavedJob from "../models/SavedJob.js";

process.env.JWT_SECRET = "bookmark-tests-only-signing-secret";

const job = { jobId: "J1+/=", title: "Welder Intern", company: "Employer", applyLink: "https://example.com/apply" };
const token = (role = "user", studentId = "S1") => jwt.sign({ email: "bookmark@example.com", role, studentId }, process.env.JWT_SECRET);
const call = (method, suffix = "", role = "user", studentId = "S1") => request(app)[method](`/api/careers/saved-jobs${suffix}`).set("Authorization", `Bearer ${token(role, studentId)}`);

beforeEach(() => jest.spyOn(Student, "exists").mockResolvedValue({ _id: "student" }));
afterEach(() => jest.restoreAllMocks());

it("requires authentication and a linked student account for every operation", async () => {
  for (const method of ["get", "post", "delete"]) {
    expect((await request(app)[method]("/api/careers/saved-jobs")).status).toBe(401);
    expect((await call(method, "", "admin")).status).toBe(403);
    expect((await call(method, "", "user", null)).status).toBe(403);
  }
  Student.exists.mockResolvedValue(null);
  expect((await call("get")).status).toBe(404);
});

it("lists only the authenticated student's persistent bookmarks", async () => {
  const lean = jest.fn().mockResolvedValue([job]);
  const select = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ select });
  const find = jest.spyOn(SavedJob, "find").mockReturnValue({ sort });
  const result = await call("get", "", "user", "S2");
  expect(result.status).toBe(200);
  expect(result.body.jobs).toEqual([job]);
  expect(find).toHaveBeenCalledWith({ studentId: "S2" });
  expect(result.headers["cache-control"]).toBe("private, no-store");
  expect((await call("get", "?studentId=S1", "user", "S2")).status).toBe(400);
});

it("saves idempotently under the JWT owner and omits private fields", async () => {
  const update = jest.spyOn(SavedJob, "findOneAndUpdate").mockResolvedValue({ toObject: () => ({ ...job, studentId: "S1", __v: 0 }) });
  for (let i = 0; i < 2; i++) {
    const result = await call("post").send({ job: { ...job, studentId: "S2" } });
    expect(result.status).toBe(200);
    expect(result.body.job).toEqual(job);
  }
  expect(update.mock.calls[0][0]).toEqual({ studentId: "S1", jobId: job.jobId });
  expect(update.mock.calls[0][1].$setOnInsert.title).toBe("Welder Intern");
  expect(update.mock.calls[0][2]).toMatchObject({ upsert: true, new: true });
  expect((await call("post").send({ studentId: "S2", job })).status).toBe(400);
});

it.each([{ ...job, applyLink: "javascript:alert(1)" }, { ...job, title: "" }, { ...job, jobId: { $ne: null } }, { ...job, company: ["Employer"] }])("rejects an invalid snapshot", async (invalid) => {
  const update = jest.spyOn(SavedJob, "findOneAndUpdate");
  expect((await call("post").send({ job: invalid })).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it("removes only the owner's bookmark and tolerates repeated removal", async () => {
  const remove = jest.spyOn(SavedJob, "deleteOne").mockResolvedValue({ deletedCount: 0 });
  expect((await call("delete", `?job_id=${encodeURIComponent(job.jobId)}`)).status).toBe(200);
  expect(remove).toHaveBeenCalledWith({ studentId: "S1", jobId: job.jobId });
  expect((await call("delete", "?job_id=J1&studentId=S2")).status).toBe(400);
});

it("handles concurrent saves and hides database failures", async () => {
  jest.spyOn(SavedJob, "findOneAndUpdate").mockRejectedValue({ code: 11000 });
  jest.spyOn(SavedJob, "findOne").mockResolvedValue({ toObject: () => job });
  expect((await call("post").send({ job })).body.job).toEqual(job);
  SavedJob.findOneAndUpdate.mockRejectedValue(new Error("Database credentials"));
  const result = await call("post").send({ job });
  expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain("Database credentials");
});
