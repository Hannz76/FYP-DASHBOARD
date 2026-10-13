import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import Student from "./models/Student.js";
import JobSearchCache from "./models/JobSearchCache.js";
import { verifyToken, requireOwnershipOrAdmin } from "./middleware/authMiddleware.js";
import { searchJobsFromProvider } from "./services/jobSearch.service.js";
import { buildStudentPathway } from "./utils/careerPathway.js";

const router = Router();
const hour = 60 * 60 * 1000;
const pendingSearches = new Map();
const limiter = rateLimit({
  windowMs: 60000,
  limit: 10,
  keyGenerator: (req) => req.user.email || req.user.studentId || "authenticated",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak carian. Sila cuba lagi selepas seminit." },
});

async function searchWithCache(query) {
  const normalized = {
    q: query.q.trim().replace(/\s+/g, " ").toLowerCase(),
    location: query.location.trim().replace(/\s+/g, " ").toLowerCase(),
    employmentType: query.employmentType,
  };
  const cacheKey = crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  if (pendingSearches.has(cacheKey)) return pendingSearches.get(cacheKey);
  const pending = (async () => {
    // TTL removal is asynchronous, so reads also enforce expiration.
    const cached = await JobSearchCache.findOne({ cacheKey, createdAt: { $gt: new Date(Date.now() - 24 * hour) } });
    if (cached) return { jobs: cached.jobs, cached: true };
    const result = await searchJobsFromProvider(normalized);
    if (!result.warning) {
      await JobSearchCache.findOneAndUpdate(
        { cacheKey },
        { $set: { query: normalized, jobs: result.jobs, createdAt: new Date() } },
        { upsert: true },
      ).catch((error) => { if (error.code !== 11000) throw error; });
    }
    return { ...result, cached: false };
  })();
  pendingSearches.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    pendingSearches.delete(cacheKey);
  }
}

router.get("/search", verifyToken, limiter, async (req, res) => {
  const { q, location = "Malaysia", employmentType = "INTERN" } = req.query;
  if (typeof q !== "string" || !q.trim() || q.length > 150 ||
      typeof location !== "string" || !location.trim() || location.length > 100 ||
      !["INTERN", "FULLTIME", "PARTTIME", "CONTRACTOR"].includes(employmentType)) {
    return res.status(400).json({ success: false, message: "Masukkan kata kunci, lokasi dan jenis pekerjaan yang sah." });
  }
  try {
    const result = await searchWithCache({ q, location, employmentType });
    return res.status(result.warning ? 503 : 200).json({ success: !result.warning, ...result });
  } catch {
    return res.status(500).json({ success: false, message: "Carian tidak dapat dimuatkan. Sila cuba lagi." });
  }
});

router.get("/pathways/:studentId", verifyToken, requireOwnershipOrAdmin, limiter, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const student = await Student.findOne({ ID_Pelajar: req.params.studentId });
    if (!student) return res.status(404).json({ success: false, message: "Pelajar tidak dijumpai." });
    const pathway = buildStudentPathway(student);
    const cache = student.careerCache;
    if (cache?.pathway?.courseCode === pathway.courseCode && cache.fetchedAt > new Date(Date.now() - hour)) {
      return res.json({ success: true, pathway, jobs: cache.recommendedJobs, cached: true });
    }
    const result = pathway.baseQuery
      ? await searchWithCache({ q: pathway.baseQuery, location: "Malaysia", employmentType: "INTERN" })
      : { jobs: [], cached: false };
    if (!result.warning) {
      await Student.updateOne({ _id: student._id }, { $set: {
        careerCache: { pathway, recommendedJobs: result.jobs, fetchedAt: new Date() },
      } });
    }
    return res.json({ success: true, pathway, ...result });
  } catch {
    return res.status(500).json({ success: false, message: "Laluan pembelajaran tidak dapat dimuatkan. Sila cuba lagi." });
  }
});

export default router;
