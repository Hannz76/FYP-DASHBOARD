import { buildStudentPathway } from "../utils/careerPathway.js";

describe("student career pathways", () => {
  it.each([
    ["ITW", "Welder / Fabricator"],
    ["DFK", "Cloud Support Trainee"],
    ["SED", "Electrical Technician"],
    ["PPU", "HVAC Technician Trainee"],
    ["SLR", "CAD Drafter Intern"],
  ])("maps %s to its supplied industry scope", (Kursus, role) => {
    expect(buildStudentPathway({ Kursus }).targetRoles).toContain(role);
  });

  it("calculates readiness and identifies specific skill gaps", () => {
    const student = { Kursus: " itw* ", CGPA: "3", Kehadiran_Pct: "90" };
    for (let i = 1; i <= 9; i++) student[`PLO_${i}`] = "60";
    const pathway = buildStudentPathway(student);
    expect(pathway.readinessScore).toBe(74);
    expect(pathway.actionPlan.find((step) => step.title === "Tingkatkan kemahiran PLO").description).toContain("PLO 9");
    expect(pathway.suggestedSearches[1]).toEqual({ label: "Oil & Gas Welder", q: "Pipe Welder NDT Intern", location: "Terengganu", employmentType: "INTERN" });
  });

  it("keeps missing data explicit and handles unmapped courses without guessing roles", () => {
    const pathway = buildStudentPathway({ Kursus: "UNKNOWN", CGPA: "invalid" });
    expect(pathway).toMatchObject({ readinessScore: 0, supported: false, targetRoles: [], baseQuery: null });
    expect(pathway.actionPlan[0].title).toBe("Lengkapkan rekod PLO");
  });

  it("bounds scores to 0..100", () => {
    const student = { CGPA: 100, Kehadiran_Pct: 200 };
    for (let i = 1; i <= 9; i++) student[`PLO_${i}`] = 200;
    expect(buildStudentPathway(student).readinessScore).toBe(100);
  });
});
