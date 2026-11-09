import { getCurrentCareerSubject } from "../item.model.js";
import { careerCache } from "./careerCache.service.js";
import { CareerError } from "../utils/careerCache.js";
import { careerPlaces, pathwayMap } from "../utils/careerPathway.js";

const day = 86400000;
const trackingParameters = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const normalize = (value) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const containsPhrase = (text, phrase) => ` ${text} `.includes(` ${normalize(phrase)} `);
const matchesRole = (title, role) => role.aliases.some((alias) => containsPhrase(title, alias));

function invalidPreferences() {
  throw new CareerError("Pilihan cadangan kerjaya tidak sah.", 400, "INVALID_PREFERENCES", 0);
}

function preferencesFrom(raw, roles) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some((key) => !["roleFamilyId", "placeId", "placeMode"].includes(key))) invalidPreferences();
  for (const value of Object.values(raw)) {
    if (typeof value !== "string" || value.length > 100 || /[\u0000-\u001f]/.test(value)) invalidPreferences();
  }
  const roleFamilyId = raw.roleFamilyId?.trim() || null;
  const placeId = raw.placeId?.trim() || null;
  if (roleFamilyId && !roles.some((role) => role.id === roleFamilyId)) invalidPreferences();
  if (placeId && !careerPlaces.some((place) => place.id === placeId)) invalidPreferences();
  if (!placeId && raw.placeMode) invalidPreferences();
  const mode = raw.placeMode ?? "prefer";
  if (placeId && !["prefer", "require"].includes(mode)) invalidPreferences();
  return { roleFamilyId, place: placeId ? { mode, placeId } : { mode: "none" } };
}

function placeEvidence(location, selected) {
  const text = normalize(location);
  const found = careerPlaces.filter((place) => place.aliases.some((alias) => containsPhrase(text, alias)));
  const states = new Set(found.map((place) => place.state || place.id));
  if (states.size !== 1) return "unknown";
  const state = [...states][0];
  const selectedState = selected.state || selected.id;
  if (state !== selectedState) return "failed";
  if (selected.state && found.filter((place) => place.state).length > 1) return "unknown";
  if (!selected.state || found.some((place) => place.id === selected.id)) return "met";
  return found.some((place) => place.state === state) ? "failed" : "unknown";
}

function cardSnapshot(input) {
  if (!input || typeof input !== "object" || typeof input.jobId !== "string" || !input.jobId.trim() || typeof input.title !== "string" || !input.title.trim() || typeof input.applyLink !== "string") return null;
  let url;
  try { url = new URL(input.applyLink); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const job = {};
  for (const field of ["jobId", "title", "company", "location", "applyLink", "salary", "postedAt", "source"]) {
    job[field] = typeof input[field] === "string" ? input[field].trim() : "";
  }
  url.hash = "";
  for (const key of trackingParameters) url.searchParams.delete(key);
  url.searchParams.sort();
  return { job, identity: JSON.stringify([url.href, normalize(job.title), normalize(job.company), normalize(job.location)]) };
}

function uniqueCandidates(pages, department, resetAt, now) {
  const candidates = [];
  for (const page of pages) {
    if (page.schemaVersion !== 3 || page.department !== department || page.resetAt !== resetAt || page.resetAt <= now || !Number.isFinite(page.fetchedAt) || page.fetchedAt > now || !Array.isArray(page.value?.jobs)) continue;
    for (const input of page.value.jobs) {
      const card = cardSnapshot(input);
      if (card) candidates.push({ ...card, fetchedAt: page.fetchedAt });
    }
  }
  candidates.sort((a, b) => b.fetchedAt - a.fetchedAt || JSON.stringify(a.job).localeCompare(JSON.stringify(b.job), "en"));
  const ids = new Set();
  const identities = new Set();
  return candidates.filter((candidate) => {
    if (ids.has(candidate.job.jobId)) return false;
    ids.add(candidate.job.jobId);
    if (identities.has(candidate.identity)) return false;
    identities.add(candidate.identity);
    return true;
  });
}

function rankCareerCandidates({ department, preferences, roles, candidates, now }) {
  const selectedPlace = careerPlaces.find((place) => place.id === preferences.place.placeId);
  const selectedRole = roles.find((role) => role.id === preferences.roleFamilyId);
  const suggestions = [];
  const needsReview = [];
  const olderAdvertisements = [];
  let strictFailures = 0;
  for (const { job } of candidates) {
    const title = normalize(job.title);
    const ownRoles = roles.filter((role) => matchesRole(title, role));
    const foreignMatch = Object.entries(pathwayMap).some(([course, mapping]) => course !== department && mapping.roleFamilies.some((role) => matchesRole(title, role)));
    if (!ownRoles.length && foreignMatch) continue;
    const ambiguousRole = !ownRoles.length || foreignMatch;
    const place = selectedPlace ? placeEvidence(job.location, selectedPlace) : "unknown";
    if (preferences.place.mode === "require" && place === "failed") { strictFailures += 1; continue; }
    const selectedRoleMatch = Boolean(selectedRole && ownRoles.some((role) => role.id === selectedRole.id));
    const posted = /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(job.postedAt) ? Date.parse(job.postedAt) : NaN;
    const calendar = Date.parse(job.postedAt.slice(0, 10));
    const postedAt = Number.isFinite(posted) && Number.isFinite(calendar) && new Date(calendar).toISOString().slice(0, 10) === job.postedAt.slice(0, 10) && posted <= now ? posted : null;
    const reasons = [];
    const checksNeeded = ["Syarat majikan belum disahkan."];
    if (ambiguousRole) checksNeeded.push("Bidang jawatan perlu disemak.");
    else reasons.push(selectedRoleMatch ? `Bidang ${selectedRole.label} pilihan anda.` : "Bidang berkaitan dengan kursus anda.");
    if (selectedPlace && place === "met") reasons.push("Lokasi pilihan anda sepadan.");
    if (selectedPlace && place === "unknown") checksNeeded.push(preferences.place.mode === "require" ? "Lokasi wajib belum dapat disahkan." : "Lokasi pilihan belum dapat disahkan.");
    if (postedAt === null) checksNeeded.push("Tarikh iklan tidak dinyatakan atau tidak sah.");
    const older = postedAt !== null && now - postedAt > 30 * day;
    if (older) checksNeeded.push("Iklan melebihi 30 hari; semak kekosongan.");
    const item = { job, reasons, checksNeeded, roleTier: selectedRole ? Number(!selectedRoleMatch) : 0, placeTier: Number(place !== "met"), postedAt };
    if (older) olderAdvertisements.push(item);
    else if (ambiguousRole || (preferences.place.mode === "require" && place === "unknown")) needsReview.push(item);
    else suggestions.push(item);
  }
  const order = (a, b) => a.roleTier - b.roleTier || a.placeTier - b.placeTier || Number(a.postedAt === null) - Number(b.postedAt === null) || (b.postedAt ?? 0) - (a.postedAt ?? 0) || normalize(a.job.title).localeCompare(normalize(b.job.title), "en") || normalize(a.job.company).localeCompare(normalize(b.job.company), "en") || a.job.jobId.localeCompare(b.job.jobId, "en");
  const publicItems = (items) => items.sort(order).map(({ job, reasons, checksNeeded }) => ({ job, reasons, checksNeeded }));
  return { suggestions: publicItems(suggestions), needsReview: publicItems(needsReview), olderAdvertisements: publicItems(olderAdvertisements), strictFailures };
}

export async function recommendForStudent(authenticatedStudentId, rawChoices = {}) {
  const { department } = await getCurrentCareerSubject(authenticatedStudentId);
  const course = pathwayMap[department];
  const roles = course?.roleFamilies || [];
  const preferences = preferencesFrom(rawChoices, roles);
  const pool = await careerCache.candidates(department);
  if (pool.department !== department) throw new CareerError("Sejarah kursus tidak dapat disahkan.", 503, "CACHE_UNAVAILABLE", 3);
  const livePages = pool.pages.filter((page) => page.schemaVersion === 3 && page.department === department && page.resetAt === pool.resetAt && page.resetAt > pool.now);
  const candidates = uniqueCandidates(livePages, department, pool.resetAt, pool.now);
  const ranked = rankCareerCandidates({ department, preferences, roles, candidates: course ? candidates : [], now: pool.now });
  const hasResults = ranked.suggestions.length + ranked.needsReview.length + ranked.olderAdvertisements.length > 0;
  const selectedRole = roles.find((role) => role.id === preferences.roleFamilyId);
  const selectedPlace = careerPlaces.find((place) => place.id === preferences.place.placeId);
  let searches = course?.suggestedSearches || [];
  if (selectedRole) {
    const relevant = searches.filter((search) => matchesRole(normalize(search.q), selectedRole));
    searches = relevant.length ? relevant : [{ label: selectedRole.label, q: selectedRole.label, location: "Malaysia", employmentType: "INTERN" }];
  }
  const { strictFailures, ...groups } = ranked;
  return {
    department,
    resetAt: pool.resetAt,
    mode: preferences.roleFamilyId || preferences.place.mode !== "none" ? "personalized" : "course-only",
    preferences,
    roleChoices: roles.map(({ id, label }) => ({ id, label })),
    placeChoices: careerPlaces.map(({ id, label }) => ({ id, label })),
    ...groups,
    emptyReason: !course ? "unmapped-course" : hasResults ? null : !livePages.length ? "no-history" : strictFailures ? "requirements-exclude-all" : "no-relevant-jobs",
    starterSearches: searches.map((search) => ({ ...search, ...(selectedPlace ? { location: selectedPlace.label } : {}) })),
  };
}
