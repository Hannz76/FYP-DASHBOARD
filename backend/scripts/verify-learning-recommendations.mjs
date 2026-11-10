import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

assert.ok(process.env.LEARNING_TEST_MONGO_URI, "Set LEARNING_TEST_MONGO_URI to a disposable MongoDB server.");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "learning-recommendations-verification-secret";
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.ML_API_URL = "http://127.0.0.1:1";
process.env.JSEARCH_API_KEY = "";
const database = `learning_recommendations_test_${randomUUID().replaceAll("-", "")}`;
const { default: app } = await import("../server.js");
const { default: Student } = await import("../models/Student.js");
const { default: User } = await import("../models/User.js");
const { default: MdbFile } = await import("../models/MdbFile.js");
const { signTokenForUser } = await import("../auth.model.js");
const allScores = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`PLO_${index + 1}`, "85"]));
const expected = { DFK: "cloud-computing", ITW: "blueprint-reading", DGA: "automotive-learning", SLR: "autocad-drafting", DCG: "electricity-foundations", SED: "electricity-foundations", PPU: "hvac-introduction" };
const resourceIds = (result) => [...result.courses, ...result.ebooks].map(({ resource }) => resource.id);
const originalFetch = globalThis.fetch;
let server;
let externalCalls = 0;

try {
  await mongoose.connect(process.env.LEARNING_TEST_MONGO_URI, { dbName: database });
  await MdbFile.create([
    { datasetName: "previous", originalName: "previous.mdb", filePath: "/test/previous.mdb", fileSize: 1, status: "Processed", processedDate: new Date("2025-01-01") },
    { datasetName: "current", originalName: "current.mdb", filePath: "/test/current.mdb", fileSize: 1, status: "Processed", processedDate: new Date(), isCurrentSemester: true },
  ]);
  await Student.create({ ID_Pelajar: "DFK-A", Kursus: "ITW", sourceDataset: "previous", ...allScores });
  for (const department of Object.keys(expected)) {
    await Student.create({ ID_Pelajar: `${department}-A`, Kursus: department === "DFK" ? " *dfk* " : department, sourceDataset: "current", ...allScores,
      Nama: "Private fixture name", No_KP: "Private fixture identifier" });
  }
  await Student.create({ ID_Pelajar: "OLD-ONLY", Kursus: "DFK", sourceDataset: "previous", ...allScores });
  const tokens = {};
  for (const studentId of [...Object.keys(expected).map((course) => `${course}-A`), "OLD-ONLY"]) {
    const user = await User.create({ email: `${studentId.toLowerCase()}@example.test`, password: "unused-fixture-hash", role: "user", studentId });
    tokens[studentId] = signTokenForUser(user);
  }
  const staff = await User.create({ email: "staff@example.test", password: "unused-fixture-hash", role: "admin" });
  tokens.STAFF = signTokenForUser(staff);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/courses/recommendations`;
  globalThis.fetch = (url, options) => {
    if (!String(url).startsWith(base)) {
      externalCalls += 1;
      throw new Error("Learning recommendations must not contact an external provider or ML.");
    }
    return originalFetch(url, options);
  };
  async function request(studentId, query = "") {
    const response = await fetch(base + query, { headers: studentId ? { Authorization: `Bearer ${tokens[studentId]}` } : {} });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    return { status: response.status, ...await response.json() };
  }
  assert.equal((await request()).status, 401);
  assert.equal((await request("STAFF")).status, 403);
  for (const [department, technicalId] of Object.entries(expected)) {
    const result = await request(`${department}-A`);
    assert.equal(result.status, 200);
    assert.equal(result.department, department);
    assert.equal(result.dataset, "current");
    assert.equal(result.mode, "enrichment");
    assert.deepEqual(result.assessment, { target: 80, gaps: [], unrecorded: [], recordedCount: 9 });
    assert.ok(resourceIds(result).includes(technicalId), `${department} must have its own relevant technical resource.`);
    for (const { resource, action } of [...result.courses, ...result.ebooks]) {
      assert.ok(resource.audience.kind === "general" || resource.audience.departments.includes(department));
      assert.equal(new URL(action.url).protocol, "https:");
      assert.equal(action.url, resource.url);
    }
    assert.ok(!JSON.stringify(result).includes("Private fixture"));
    if (department !== "DFK") assert.ok(!resourceIds(result).includes("cloud-computing"));
  }
  const update = (scores) => Student.updateOne({ ID_Pelajar: "DFK-A", sourceDataset: "current" }, { $set: scores });
  await update({ PLO_1: "0", PLO_2: "55", PLO_3: "65", PLO_4: "-1", PLO_5: "101", PLO_6: "invalid", PLO_7: "", PLO_8: "80", PLO_9: "90" });
  const gaps = await request("DFK-A");
  assert.deepEqual(gaps.assessment, { target: 80, gaps: [{ plo: 2, score: 55 }, { plo: 3, score: 65 }], unrecorded: [1, 4, 5, 6, 7], recordedCount: 4 });
  assert.equal(gaps.mode, "course-foundations");
  assert.deepEqual(gaps.courses[0].reasons, ["Berdasarkan kursus DFK anda."]);
  await update(Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`PLO_${index + 1}`, "0"])));
  const missing = await request("DFK-A");
  assert.equal(missing.assessment.recordedCount, 0);
  assert.deepEqual(missing.assessment.gaps, []);
  assert.ok(resourceIds(missing).includes("cloud-computing"));
  assert.ok(missing.notices.includes("Rekod penilaian belum lengkap. Bahan dicadangkan berdasarkan kursus anda."));
  await update({ ...allScores, PLO_1: "80", PLO_2: "0" });
  const noGap = await request("DFK-A");
  assert.equal(noGap.mode, "enrichment");
  assert.deepEqual(noGap.assessment.gaps, []);
  assert.deepEqual(noGap.assessment.unrecorded, [2]);
  for (const query of ["?studentId=ITW-A", "?department=ITW", "?dataset=previous", "?PLO_1=10"]) assert.equal((await request("DFK-A", query)).status, 400);
  assert.equal((await request("OLD-ONLY")).code, "MEMBERSHIP_UNAVAILABLE");
  await Student.updateOne({ ID_Pelajar: "DFK-A", sourceDataset: "current" }, { $set: { Kursus: "ITW" } });
  const moved = await request("DFK-A");
  assert.equal(moved.department, "ITW");
  assert.ok(resourceIds(moved).includes("blueprint-reading"));
  assert.ok(!resourceIds(moved).includes("cloud-computing"));
  assert.equal(externalCalls, 0);
  console.log("PASS: all seven courses receive their own resources; current membership overrides old snapshots and rejects old-only access.");
  console.log("PASS: missing, invalid and zero assessments never create false gaps; exact 80 and incomplete enrichment are handled.");
  console.log("PASS: unauthenticated and forged requests are rejected; private responses contain no student PII and make no provider, Redis or ML request.");
} catch (error) {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) {
    assert.equal(mongoose.connection.name, database);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
