import { getCurrentCareerSubject } from "../item.model.js";
import { learningCatalog } from "../data/learningCatalog.js";

const target = 80;

function recordedScore(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const score = Number(value);
  return Number.isFinite(score) && score > 0 && score <= 100 ? score : null;
}

function destination(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export async function recommendLearningForStudent(authenticatedStudentId) {
  const { department, dataset, student } = await getCurrentCareerSubject(authenticatedStudentId);
  const scores = Array.from({ length: 9 }, (_, index) => ({ plo: index + 1, score: recordedScore(student[`PLO_${index + 1}`]) }));
  const unrecorded = scores.filter(({ score }) => score === null).map(({ plo }) => plo);
  const gaps = scores.filter(({ score }) => score !== null && score < target).sort((a, b) => a.score - b.score || a.plo - b.plo).slice(0, 2);
  const recordedCount = 9 - unrecorded.length;
  const notices = [];
  if (unrecorded.length) notices.push(`Penilaian ${unrecorded.map((plo) => `PLO ${plo}`).join(", ")} belum direkodkan atau tidak sah. Nilai ini tidak dianggap kelemahan.`);
  if (!gaps.length && recordedCount) notices.push("Tiada skor PLO yang direkodkan di bawah sasaran 80. Bahan ini untuk penerokaan dan pengukuhan pembelajaran.");
  const alignments = learningCatalog.alignments.filter((mapping) => mapping.status === "reviewed" && mapping.department === department && mapping.evidenceRef && mapping.reviewedAt);
  if (gaps.some(({ plo }) => !alignments.some((mapping) => mapping.plo === plo))) notices.push("Cadangan ini menggunakan asas kursus apabila hubungan topik dengan PLO belum disahkan oleh pensyarah.");
  if (!recordedCount) notices.push("Rekod penilaian belum lengkap. Bahan dicadangkan berdasarkan kursus anda.");

  const eligible = learningCatalog.resources.filter((resource) => resource.publication.status === "active"
    && ["free-open", "free-account"].includes(resource.publication.access.kind)
    && destination(resource.url) && destination(resource.publication.evidenceUrl)
    && (resource.audience.kind === "general" || resource.audience.departments.includes(department))
    && (resource.level === "introductory" || resource.kind === "provider-catalog"));
  const order = (a, b) => a.tier - b.tier || a.resource.editorialOrder - b.resource.editorialOrder || a.resource.id.localeCompare(b.resource.id, "en");
  const candidates = eligible.map((resource) => {
    const gapIndex = gaps.findIndex(({ plo }) => alignments.some((mapping) => mapping.plo === plo && mapping.topics.some((topic) => resource.topics.includes(topic))));
    const tier = gapIndex >= 0 ? gapIndex : resource.audience.kind === "program" ? 2 : 3;
    const reasons = gapIndex >= 0
      ? [`Topik dipetakan kepada PLO ${gaps[gapIndex].plo} yang disemak, skor ${gaps[gapIndex].score} berbanding sasaran ${target}.`]
      : [resource.audience.kind === "program" ? `Berdasarkan kursus ${department} anda.` : "Bahan umum untuk menyokong pembelajaran anda."];
    const notes = [];
    const label = resource.kind === "ebook" ? "Baca e-buku" : resource.kind === "provider-catalog" ? "Buka portal pembelajaran" : "Mula Belajar";
    return { resource, reasons, notes, action: { label, url: resource.url }, tier };
  }).sort(order);

  const seenIds = new Set();
  const seenUrls = new Set();
  const unique = candidates.filter(({ resource }) => {
    const url = destination(resource.url);
    if (seenIds.has(resource.id) || seenUrls.has(url)) return false;
    seenIds.add(resource.id); seenUrls.add(url);
    return true;
  });
  const choose = (ebook) => {
    const items = unique.filter(({ resource }) => (resource.kind === "ebook") === ebook);
    const selected = [];
    for (const tier of [0, 1]) {
      const first = items.find((item) => item.tier === tier);
      if (first) selected.push(first);
    }
    const foundation = items.find((item) => item.tier === 2);
    if (foundation) selected.push(foundation);
    for (const item of items.filter((item) => item.tier >= 2)) {
      if (selected.length >= 3) break;
      if (!selected.includes(item)) selected.push(item);
    }
    return selected.sort(order).map(({ tier, ...item }) => item);
  };
  const courses = choose(false);
  const ebooks = choose(true);
  const hasGapRecommendation = unique.some(({ tier }) => tier < 2);
  return {
    department, dataset, catalogVersion: learningCatalog.version,
    mode: hasGapRecommendation ? "reviewed-gaps" : !gaps.length && recordedCount ? "enrichment" : "course-foundations",
    courses, ebooks, assessment: { target, gaps, unrecorded, recordedCount }, notices,
    emptyReason: courses.length || ebooks.length ? null : "catalog-coverage-gap",
  };
}
