import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const getCurrentCareerSubject = jest.fn();
jest.unstable_mockModule("../item.model.js", () => ({ getCurrentCareerSubject }));
const { learningCatalog } = await import("../data/learningCatalog.js");
const { recommendLearningForStudent } = await import("../services/courseRecommendation.service.js");
const originalResources = structuredClone(learningCatalog.resources);
const ids = (items) => items.map(({ resource }) => resource.id);
const scores = (values = {}) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`PLO_${i + 1}`, values[i + 1] ?? "90"]));
const fixture = (id, topics, extra = {}) => ({ ...structuredClone(originalResources[0]), id, title: id, url: `https://example.test/${id}`, topics, editorialOrder: 10, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  learningCatalog.resources = structuredClone(originalResources);
  learningCatalog.alignments = [];
  getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: scores({ 1: "55", 2: "65" }) });
});

describe("current-student learning recommendations", () => {
  it.each([
    ["DFK", ["cloud-computing"], ["computing-foundations", "trades-study-skills", "trades-communication"]],
    ["ITW", [], ["blueprint-reading", "trades-study-skills", "trades-communication"]],
    ["SLR", [], ["autocad-drafting", "blueprint-reading", "trades-study-skills"]],
    ["DCG", [], ["electricity-foundations", "trades-study-skills", "trades-communication"]],
    ["SED", [], ["electricity-foundations", "trades-study-skills", "trades-communication"]],
    ["DGA", ["automotive-learning"], ["trades-study-skills", "trades-communication"]],
    ["PPU", ["hvac-introduction"], ["trades-study-skills", "trades-communication"]],
  ])("returns the reviewed subject catalog for %s without borrowing another course", async (department, courses, ebooks) => {
    getCurrentCareerSubject.mockResolvedValue({ department, dataset: "current", student: scores() });
    const result = await recommendLearningForStudent("own-student");
    expect(ids(result.courses)).toEqual(courses);
    expect(ids(result.ebooks)).toEqual(ebooks);
    expect(result).toMatchObject({ department, dataset: "current", mode: "enrichment", emptyReason: null });
    expect(result.courses.concat(result.ebooks).every(({ resource }) => resource.audience.kind === "general" || resource.audience.departments.includes(department))).toBe(true);
  });

  it("skips unrecorded and invalid scores and selects the two weakest recorded gaps", async () => {
    getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: { PLO_1: "0", PLO_2: "68.5", PLO_3: "55", PLO_4: "", PLO_5: "80", PLO_6: "0x10", PLO_7: true, PLO_8: ["20"], PLO_9: "101" } });
    const result = await recommendLearningForStudent("own-student");
    expect(result.assessment).toEqual({ target: 80, gaps: [{ plo: 3, score: 55 }, { plo: 2, score: 68.5 }], unrecorded: [1, 4, 6, 7, 8, 9], recordedCount: 3 });
    expect(result.mode).toBe("course-foundations");
    expect(result.courses[0].reasons).toEqual(["Berdasarkan kursus DFK anda."]);
    expect(result.notices).toContain("Cadangan ini menggunakan asas kursus apabila hubungan topik dengan PLO belum disahkan oleh pensyarah.");
  });

  it("retains foundations with no recorded assessment rather than inventing weakness", async () => {
    getCurrentCareerSubject.mockResolvedValue({ department: "ITW", dataset: "current", student: { PLO_1: 0, PLO_2: "NaN", PLO_3: "-1", PLO_4: Infinity } });
    const result = await recommendLearningForStudent("own-student");
    expect(result.assessment).toEqual({ target: 80, gaps: [], unrecorded: [1, 2, 3, 4, 5, 6, 7, 8, 9], recordedCount: 0 });
    expect(result.mode).toBe("course-foundations");
    expect(ids(result.ebooks)).toEqual(["blueprint-reading", "trades-study-skills", "trades-communication"]);
    expect(result.notices).toContain("Rekod penilaian belum lengkap. Bahan dicadangkan berdasarkan kursus anda.");
  });

  it("treats exactly 80 as meeting the target while preserving an incomplete-data notice", async () => {
    getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: scores({ 1: "80", 2: "0" }) });
    const result = await recommendLearningForStudent("own-student");
    expect(result.assessment).toEqual({ target: 80, gaps: [], unrecorded: [2], recordedCount: 8 });
    expect(result.mode).toBe("enrichment");
    expect(result.notices).toContain("Tiada skor PLO yang direkodkan di bawah sasaran 80. Bahan ini untuk penerokaan dan pengukuhan pembelajaran.");
    expect(result.notices[0]).toContain("PLO 2 belum direkodkan");
  });

  it("only uses reviewed program mappings and reranks for the current student's gaps", async () => {
    learningCatalog.resources = [fixture("X", ["topic-x"]), fixture("Y", ["topic-y"]), fixture("foundation", ["other"]), fixture("candidate", ["candidate-topic"])];
    learningCatalog.alignments = [
      { status: "reviewed", department: "DFK", plo: 2, topics: ["topic-x"], reviewedAt: "2026-11-10", evidenceRef: "fixture-lecturer-review" },
      { status: "reviewed", department: "DFK", plo: 6, topics: ["topic-y"], reviewedAt: "2026-11-10", evidenceRef: "fixture-lecturer-review" },
      { status: "candidate", department: "DFK", plo: 2, topics: ["candidate-topic"] },
    ];
    getCurrentCareerSubject.mockResolvedValueOnce({ department: "DFK", dataset: "current", student: scores({ 2: "55", 6: "64" }) });
    const first = await recommendLearningForStudent("student-a");
    expect(ids(first.courses)).toEqual(["X", "Y", "candidate"]);
    expect(first.mode).toBe("reviewed-gaps");
    expect(first.courses[0].reasons).toEqual(["Topik dipetakan kepada PLO 2 yang disemak, skor 55 berbanding sasaran 80."]);
    expect(first.courses[2].reasons).toEqual(["Berdasarkan kursus DFK anda."]);
    getCurrentCareerSubject.mockResolvedValueOnce({ department: "DFK", dataset: "current", student: scores({ 2: "76", 6: "48" }) });
    expect(ids((await recommendLearningForStudent("student-b")).courses)).toEqual(["Y", "X", "candidate"]);
  });

  it("does not substitute a less-urgent mapped third gap for the two weakest gaps", async () => {
    learningCatalog.resources = [fixture("third-gap", ["topic-x"])];
    learningCatalog.alignments = [{ status: "reviewed", department: "DFK", plo: 3, topics: ["topic-x"], reviewedAt: "2026-11-10", evidenceRef: "fixture-review" }];
    getCurrentCareerSubject.mockResolvedValueOnce({ department: "DFK", dataset: "current", student: scores({ 1: "20", 2: "30", 3: "40" }) });
    const result = await recommendLearningForStudent("own-student");
    expect(result.assessment.gaps).toEqual([{ plo: 1, score: 20 }, { plo: 2, score: 30 }]);
    expect(result.courses[0].reasons).toEqual(["Berdasarkan kursus DFK anda."]);
    expect(result.mode).toBe("course-foundations");
  });

  it("omits pending, paid, advanced and unsafe entries and deduplicates destinations", async () => {
    const valid = fixture("valid", ["topic"]);
    learningCatalog.resources = [
      valid, { ...valid, id: "same-destination" },
      fixture("pending", ["topic"], { publication: { ...valid.publication, status: "pending" } }),
      fixture("paid", ["topic"], { publication: { ...valid.publication, access: { kind: "paid" } } }),
      fixture("unsafe", ["topic"], { url: "javascript:alert(1)" }),
      fixture("private-url", ["topic"], { url: "https://user:pass@example.test/job" }),
      fixture("advanced", ["topic"], { level: "advanced" }),
    ];
    const result = await recommendLearningForStudent("own-student");
    expect(ids(result.courses)).toEqual(["same-destination"]);
    expect(result.courses[0].action).toEqual({ label: "Mula Belajar", url: "https://example.test/valid" });
    learningCatalog.resources = [];
    expect(await recommendLearningForStudent("own-student")).toMatchObject({ courses: [], ebooks: [], emptyReason: "catalog-coverage-gap" });
  });

  it("labels account-required portals and does not use risk, certificates or student PII to rank", async () => {
    const portal = fixture("portal", ["automotive"], { kind: "provider-catalog", level: "unknown" });
    portal.publication.access = { kind: "free-account", note: "Akaun percuma diperlukan." };
    learningCatalog.resources = [portal];
    getCurrentCareerSubject.mockResolvedValue({ department: "DFK", dataset: "current", student: { ...scores(), Nama: "Private name", No_KP: "Private identifier", Status_Pelajar: "Bermasalah", CGPA: "0.5", Sijil_Profesional: "Tiada" } });
    const result = await recommendLearningForStudent("own-student");
    expect(result.courses[0].action.label).toBe("Buka portal pembelajaran");
    expect(result.courses[0].resource.publication.access.note).toBe("Akaun percuma diperlukan.");
    expect(result.courses[0].notes).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(result.mode).toBe("enrichment");
  });

  it("propagates current-subject failure rather than claiming an empty catalog", async () => {
    getCurrentCareerSubject.mockRejectedValueOnce(Object.assign(new Error("Current membership missing"), { code: "MEMBERSHIP_UNAVAILABLE" }));
    await expect(recommendLearningForStudent("own-student")).rejects.toMatchObject({ code: "MEMBERSHIP_UNAVAILABLE" });
  });
});
