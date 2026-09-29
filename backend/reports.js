import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Report from "./models/Report.js";
import User from "./models/User.js";
import { verifyToken, requireAdmin, requireStaff } from "./middleware/authMiddleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "referrals");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const ALLOWED_MIME = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME[file.mimetype] && ALLOWED_MIME[file.mimetype] === ext) {
      return cb(null, true);
    }
    cb(new Error("Hanya fail PDF, JPG atau PNG sahaja dibenarkan!"));
  },
});

// POST /api/reports — Admin creates a counselor referral (multipart: fields + optional file)
router.post("/reports", verifyToken, requireAdmin, upload.single("file"), async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      course,
      cgpa,
      attendance,
      riskLevel,
      interventionType,
      reason,
      priority,
      scheduledDate,
      counselorId,
    } = req.body;

    const fail = (status, message) => {
      if (req.file) {
        const p = path.join(process.cwd(), "uploads", "referrals", req.file.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      return res.status(status).json({ message });
    };

    if (!studentId || !studentName || !interventionType || !reason || !scheduledDate || !counselorId) {
      return fail(400, "Sila lengkapkan semua medan wajib.");
    }

    const parsedDate = new Date(scheduledDate);
    if (isNaN(parsedDate.getTime())) {
      return fail(400, "Tarikh temujanji tidak sah.");
    }

    const counselor = await User.findOne({ email: String(counselorId).toLowerCase(), role: "counselor" });
    if (!counselor) {
      return fail(400, "Kaunselor tidak sah.");
    }

    const report = new Report({
      studentId,
      studentName,
      course: course || "",
      cgpa: cgpa || "",
      attendance: attendance || "",
      riskLevel: riskLevel || "",
      interventionType,
      reason,
      priority: priority || "normal",
      status: "scheduled",
      scheduledDate: parsedDate,
      counselorId: counselor.email,
      fileName: req.file ? req.file.originalname : null,
      filePath: req.file ? `/uploads/referrals/${req.file.filename}` : null,
      adminEmail: req.user.email,
    });

    await report.save();
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports — Admin sees all, counselor sees pending + assigned
router.get("/reports", verifyToken, requireStaff, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "counselor") {
      query = {
        $or: [
          { status: "pending" },
          { counselorId: req.user.email },
        ],
      };
    }
    const reports = await Report.find(query).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/mine — Student sees own upcoming referrals (must precede /reports/:id)
router.get("/reports/mine", verifyToken, async (req, res) => {
  try {
    if (!req.user.studentId) return res.json([]);
    const reports = await Report.find({
      studentId: req.user.studentId,
      status: { $in: ["accepted", "scheduled"] },
    })
      .select("interventionType scheduledDate status priority reason counselorId counselorNotes adminEmail fileName filePath studentId course")
      .sort({ scheduledDate: 1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/reports/:id — Single referral
router.get("/reports/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Laporan tidak dijumpai." });

    if (req.user.role === "counselor" && report.status !== "pending" && report.counselorId !== req.user.email) {
      return res.status(403).json({ message: "Akses ditolak." });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/reports/:id — Counselor updates status/notes/date
router.patch("/reports/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const { status, counselorNotes, scheduledDate } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Laporan tidak dijumpai." });

    const allowedAdminStatuses = ["pending", "rejected", "completed"];
    const isAdmin = req.user.role === "admin";
    const isCounselor = req.user.role === "counselor";

    if (isAdmin && status && !allowedAdminStatuses.includes(status)) {
      return res.status(403).json({ message: "Admin hanya boleh set semula ke pending/rejected." });
    }

    if (isCounselor && report.status === "pending") {
      if (status === "accepted") {
        report.status = "accepted";
        report.counselorId = req.user.email;
      } else if (status === "rejected") {
        report.status = "rejected";
      }
    } else if (isCounselor && report.counselorId === req.user.email) {
      if (status === "scheduled" && scheduledDate) {
        report.status = "scheduled";
        report.scheduledDate = new Date(scheduledDate);
      } else if (status === "completed") {
        report.status = "completed";
        if (counselorNotes !== undefined) report.counselorNotes = counselorNotes;
      }
      if (counselorNotes !== undefined && report.status !== "completed") {
        report.counselorNotes = counselorNotes;
      }
    } else if (isAdmin) {
      if (status) report.status = status;
    } else {
      return res.status(403).json({ message: "Akses ditolak." });
    }

    await report.save();
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
