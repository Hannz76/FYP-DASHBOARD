import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getCurrentCareerSubject = jest.fn();
const readCandidates = jest.fn();
jest.unstable_mockModule("../item.model.js", () => ({ getCurrentCareerSubject }));
jest.unstable_mockModule("../services/careerCache.service.js", () => ({ careerCache: { candidates: readCandidates } }));
const { recommendForStudent } = await import("../services/careerRecommendations.service.js");
const { buildStudentPathway } = await import("../utils/careerPathway.js");

const now = Date.parse("2026-11-09T00:00:00Z");
const day = 86400000;
const resetAt = now + day;
const job = (jobId, title, location = "Selangor", age = 0, extra = {}) => ({ jobId, title, location, company: "Example Employer", applyLink: `https://example.test/apply/${jobId}`, postedAt: new Date(now - age * day).toISOString(), salary: "Gaji / elaun tidak dinyatakan", source: "Fixture", ...extra });
const page = (jobs, extra = {}) => ({ schemaVersion: 3, department: "DFK", params: { query: "fixture" }, fetchedAt: now - 1000, resetAt, value: { jobs, cursor: null }, ...extra });
const pool = (pages) => ({ department: "DFK", now, resetAt, pages });
const ids = (items) => items.map(({ job: card }) => card.jobId);
const fixtures = [job("A", "Cloud Support Intern", "Selangor", 4), job("B", "Cloud Support Intern", "Penang", 1), job("C", "IT Support Intern"), job("D", "Technology Programme", "Not stated", 0, { postedAt: "" }), job("E", "Cloud Support Intern", "Selangor", 60), job("G", "Pipe Welder Intern")];

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: { CGPA: "3.5" } });
  readCandidates.mockResolvedValue(pool([page(fixtures)]));
});

describe("personalized saved career recommendations", () => {
  it("ranks the chosen role before place and date, with separate review and older groups", async () => {
    const result = await recommendForStudent("DFK-A", { roleFamilyId: "cloud-support", placeId: "selangor" });
    expect(ids(result.suggestions)).toEqual(["A", "B", "C"]);
    expect(ids(result.needsReview)).toEqual(["D"]);
    expect(ids(result.olderAdvertisements)).toEqual(["E"]);
    expect(result.suggestions[0].reasons).toEqual(["Bidang Cloud Support Trainee pilihan anda.", "Lokasi pilihan anda sepadan."]);
    expect(result.suggestions[0].checksNeeded).toContain("Syarat majikan belum disahkan.");
    expect(result).toMatchObject({ department: "DFK", mode: "personalized", resetAt, emptyReason: null, preferences: { roleFamilyId: "cloud-support", place: { mode: "prefer", placeId: "selangor" } } });
    expect(result.starterSearches[0]).toMatchObject({ q: "Cloud Computing Support Intern", location: "Selangor" });
  });

  it("reranks the same pool for the other student's role and required place", async () => {
    const result = await recommendForStudent("DFK-B", { roleFamilyId: "it-support", placeId: "selangor", placeMode: "require" });
    expect(ids(result.suggestions)).toEqual(["C", "A"]);
    expect(ids(result.needsReview)).toEqual(["D"]);
    expect(ids(result.olderAdvertisements)).toEqual(["E"]);
    expect(result.needsReview[0].checksNeeded).toContain("Lokasi wajib belum dapat disahkan.");
    expect(result.starterSearches[0].q).toBe("IT Support Technician Intern");
    expect(getCurrentCareerSubject).toHaveBeenCalledWith("DFK-B");
    expect(readCandidates).toHaveBeenCalledWith("DFK");
  });

  it("keeps unknown and different soft places tied, then compares posting dates", async () => {
    readCandidates.mockResolvedValue(pool([page([job("unknown", "Cloud Support Intern", "Not stated", 1), job("other", "Cloud Support Intern", "Penang")])]));
    const result = await recommendForStudent("DFK-A", { placeId: "selangor" });
    expect(ids(result.suggestions)).toEqual(["other", "unknown"]);
    expect(result.suggestions[1].checksNeeded).toContain("Lokasi pilihan belum dapat disahkan.");
  });

  it("distinguishes required city from broad state or multiple locations", async () => {
    readCandidates.mockResolvedValue(pool([page([job("city", "Cloud Support Intern", "Petaling Jaya, Selangor"), job("state", "Cloud Support Intern", "Selangor"), job("other-city", "Cloud Support Intern", "Shah Alam, Selangor"), job("multiple", "Cloud Support Intern", "Selangor, Penang"), job("two-cities", "Cloud Support Intern", "Petaling Jaya or Shah Alam, Selangor")])]));
    const result = await recommendForStudent("DFK-A", { placeId: "petaling-jaya", placeMode: "require" });
    expect(ids(result.suggestions)).toEqual(["city"]);
    expect(ids(result.needsReview)).toEqual(["multiple", "state", "two-cities"]);
  });

  it("never restores strict failures through older ads but preserves unknown checks there", async () => {
    readCandidates.mockResolvedValue(pool([page([job("failed", "Cloud Support Intern", "Penang", 60), job("unknown", "Technology Programme", "Not stated", 60)])]));
    const result = await recommendForStudent("DFK-A", { placeId: "selangor", placeMode: "require" });
    expect(result.suggestions).toEqual([]);
    expect(result.needsReview).toEqual([]);
    expect(ids(result.olderAdvertisements)).toEqual(["unknown"]);
    expect(result.olderAdvertisements[0].checksNeeded).toEqual(["Syarat majikan belum disahkan.", "Bidang jawatan perlu disemak.", "Lokasi wajib belum dapat disahkan.", "Iklan melebihi 30 hari; semak kekosongan."]);
    readCandidates.mockResolvedValue(pool([page([job("failed", "Cloud Support Intern", "Penang", 60)])]));
    expect((await recommendForStudent("DFK-A", { placeId: "selangor", placeMode: "require" })).emptyReason).toBe("requirements-exclude-all");
  });

  it("collapses duplicate IDs and URLs without mixing snapshots or merging distinct vacancies", async () => {
    const newer = job("same", "IT Support Intern", "Selangor", 3, { salary: "RM 1000", studentId: "never-return" });
    readCandidates.mockResolvedValue(pool([
      page([job("same", "Cloud Support Intern", "Penang", 2, { salary: "RM 9999" })], { fetchedAt: now - 3000 }),
      page([newer, { ...newer, jobId: "duplicate", applyLink: `${newer.applyLink}?utm_source=fixture#card` }, { ...newer, jobId: "distinct", applyLink: `${newer.applyLink}?application=other` }, job("other-role", "Cloud Support Intern", "Selangor", 3, { applyLink: newer.applyLink })]),
    ]));
    const result = await recommendForStudent("DFK-A");
    expect(ids(result.suggestions)).toEqual(["other-role", "distinct", "duplicate"]);
    expect(result.suggestions[1].job).toMatchObject({ title: "IT Support Intern", location: "Selangor", salary: "RM 1000" });
    expect(result.suggestions[1].job).not.toHaveProperty("studentId");
  });

  it("ignores foreign, legacy and expired pages, and unsafe cards", async () => {
    readCandidates.mockResolvedValue(pool([
      page([job("foreign", "Cloud Support Intern")], { department: "ITW" }), page([job("legacy", "Cloud Support Intern")], { schemaVersion: 2 }), page([job("expired", "Cloud Support Intern")], { resetAt: now }),
      page([job("bad-url", "Cloud Support Intern", "Selangor", 0, { applyLink: "javascript:alert(1)" }), job("bad-user", "Cloud Support Intern", "Selangor", 0, { applyLink: "https://user:pass@example.test/job" }), job("", "Cloud Support Intern"), job("valid", "Cloud Support Intern")]),
    ]));
    expect(ids((await recommendForStudent("DFK-A")).suggestions)).toEqual(["valid"]);
  });

  it("does not promote missing or future dates above known dates", async () => {
    readCandidates.mockResolvedValue(pool([page([job("future", "Cloud Support Intern", "Selangor", -1), job("missing", "Cloud Support Intern", "Selangor", 0, { postedAt: "" }), job("known", "Cloud Support Intern", "Selangor", 2)])]));
    const result = await recommendForStudent("DFK-A");
    expect(ids(result.suggestions)).toEqual(["known", "future", "missing"]);
    expect(result.suggestions[1].checksNeeded).toContain("Tarikh iklan tidak dinyatakan atau tidak sah.");
  });

  it("keeps impossible calendar dates unconfirmed instead of manufacturing an older posting", async () => {
    readCandidates.mockResolvedValue(pool([page([job("calendar-invalid", "Cloud Support Intern", "Selangor", 0, { postedAt: "2026-02-31T00:00:00Z" }), job("known", "Cloud Support Intern", "Selangor", 2)])]));
    const result = await recommendForStudent("DFK-A");
    expect(ids(result.suggestions)).toEqual(["known", "calendar-invalid"]);
    expect(result.olderAdvertisements).toEqual([]);
    expect(result.suggestions[1].checksNeeded).toContain("Tarikh iklan tidak dinyatakan atau tidak sah.");
  });

  it("labels course-only defaults and does not rank using academic scalars", async () => {
    const first = await recommendForStudent("DFK-A");
    getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: { CGPA: "0.5", PLO_1: "0", Status_Pelajar: "Bermasalah" } });
    const second = await recommendForStudent("DFK-B");
    expect(first.mode).toBe("course-only");
    expect(ids(first.suggestions)).toEqual(["C", "B", "A"]);
    expect(ids(second.suggestions)).toEqual(["C", "B", "A"]);
    expect(first.roleChoices.map((role) => role.id)).toEqual(["cloud-support", "it-support", "system-admin"]);
  });

  it("distinguishes no history, no relevant jobs and unmapped course", async () => {
    readCandidates.mockResolvedValue(pool([]));
    expect((await recommendForStudent("DFK-A")).emptyReason).toBe("no-history");
    readCandidates.mockResolvedValue(pool([page([])]));
    expect((await recommendForStudent("DFK-A")).emptyReason).toBe("no-relevant-jobs");
    getCurrentCareerSubject.mockResolvedValue({ department: "DGA" });
    readCandidates.mockResolvedValue({ ...pool([]), department: "DGA" });
    const result = await recommendForStudent("DGA-A");
    expect(result).toMatchObject({ emptyReason: "unmapped-course", roleChoices: [], starterSearches: [], suggestions: [] });
    expect(result.placeChoices).toContainEqual({ id: "selangor", label: "Selangor" });
  });

  it.each([{ department: "ITW" }, { studentId: "OTHER" }, { cgpa: "4" }, { roleFamilyId: "welding" }, { placeId: "unknown" }, { placeMode: "require" }, { placeId: "selangor", placeMode: "ignore" }, { roleFamilyId: ["cloud-support"] }])("rejects unsupported or forged choices %j before reading history", async (choices) => {
    await expect(recommendForStudent("DFK-A", choices)).rejects.toMatchObject({ status: 400, code: "INVALID_PREFERENCES" });
    expect(readCandidates).not.toHaveBeenCalled();
  });

  it("propagates membership/cache failures instead of claiming history is empty", async () => {
    getCurrentCareerSubject.mockRejectedValueOnce(Object.assign(new Error("Membership unavailable"), { code: "MEMBERSHIP_UNAVAILABLE" }));
    await expect(recommendForStudent("DFK-A")).rejects.toMatchObject({ code: "MEMBERSHIP_UNAVAILABLE" });
    expect(readCandidates).not.toHaveBeenCalled();
    readCandidates.mockRejectedValueOnce(Object.assign(new Error("Cache unavailable"), { code: "CACHE_UNAVAILABLE" }));
    await expect(recommendForStudent("DFK-A")).rejects.toMatchObject({ code: "CACHE_UNAVAILABLE" });
  });

  it("preserves the pathway target-role API from the single registry", () => {
    const result = buildStudentPathway({ Kursus: "DFK" });
    expect(result.targetRoles).toEqual(["Cloud Support Trainee", "IT Support Technician", "System Administrator Assistant"]);
    expect(result).not.toHaveProperty("roleFamilies");
  });
});
