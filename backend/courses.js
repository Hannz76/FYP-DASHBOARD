import { Router } from "express";
import { verifyToken } from "./middleware/authMiddleware.js";
import { recommendLearningForStudent } from "./services/courseRecommendation.service.js";

const router = Router();
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
router.use(verifyToken);
router.get("/recommendations", async (req, res) => {
  if (req.user.role !== "user" || !req.user.studentId) return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Hanya pelajar boleh melihat cadangan pembelajaran sendiri." });
  if (Object.keys(req.query).length) return res.status(400).json({ success: false, code: "INVALID_QUERY", message: "Parameter cadangan pembelajaran tidak dibenarkan." });
  try {
    return res.json({ success: true, ...await recommendLearningForStudent(req.user.studentId) });
  } catch (error) {
    if (["MEMBERSHIP_UNAVAILABLE", "INVALID_DEPARTMENT"].includes(error.code)) return res.status(403).json({ success: false, code: error.code, message: error.message });
    return res.status(503).json({ success: false, code: "LEARNING_UNAVAILABLE", message: "Cadangan pembelajaran tidak dapat dimuatkan. Sila cuba lagi." });
  }
});

export default router;
