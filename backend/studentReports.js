import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import StudentReport from "./models/StudentReport.js";
import { verifyToken, requireStaff, requireOwnershipOrAdmin } from "./middleware/authMiddleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "reports");
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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase() === ".pdf";
    const mimetype = file.mimetype === "application/pdf";
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Error: Hanya fail PDF sahaja dibenarkan!"));
  },
});

// POST /api/student-reports — Staff generates a report for a student
router.post(
  "/student-reports",
  verifyToken,
  requireStaff,
  upload.single("file"),
  async (req, res) => {
    try {
      const {
        studentId,
        studentName,
        course,
        cgpa,
        attendance,
        riskLevel,
        semester,
        ploScores,
        employability,
        title,
        message,
      } = req.body;

      if (!studentId || !studentName || !title) {
        return res.status(400).json({ message: "Sila lengkapkan medan wajib." });
      }

      const hasMessage = message && message.trim().length > 0;
      const hasFile = !!req.file;
      let reportType = "message";
      if (hasMessage && hasFile) reportType = "full";
      else if (hasFile) reportType = "letter";

      const report = new StudentReport({
        studentId,
        studentName,
        course: course || "",
        cgpa: cgpa || "",
        attendance: attendance || "",
        riskLevel: riskLevel || "",
        semester: semester || "",
        ploScores: ploScores ? JSON.parse(ploScores) : [],
        employability: Number(employability) || 0,
        authorEmail: req.user.email,
        authorRole: req.user.role,
        authorName: req.user.displayName || req.user.email,
        title,
        message: message || "",
        fileName: req.file ? req.file.originalname : null,
        filePath: req.file ? `/uploads/reports/${req.file.filename}` : null,
        reportType,
      });

      await report.save();
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /api/student-reports — Staff sees own reports; students see received reports
router.get("/student-reports", verifyToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "user") {
      query = { studentId: req.user.studentId };
    } else if (req.user.role === "counselor") {
      query = { authorEmail: req.user.email };
    }
    // admin sees all
    const reports = await StudentReport.find(query).sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/student-reports/:id — Single report
router.get("/student-reports/:id", verifyToken, async (req, res) => {
  try {
    const report = await StudentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Laporan tidak dijumpai." });

    const isOwner = req.user.role === "user" && report.studentId === req.user.studentId;
    const isAuthor = report.authorEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAuthor && !isAdmin) {
      return res.status(403).json({ message: "Akses ditolak." });
    }

    if (isOwner && !report.readByStudent) {
      report.readByStudent = true;
      await report.save();
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/student-reports/:id — Staff deletes own reports, admin any
router.delete("/student-reports/:id", verifyToken, requireStaff, async (req, res) => {
  try {
    const report = await StudentReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Laporan tidak dijumpai." });

    const isAdmin = req.user.role === "admin";
    const isAuthor = report.authorEmail === req.user.email;

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ message: "Akses ditolak." });
    }

    if (report.filePath) {
      const filePath = path.join(process.cwd(), report.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await report.deleteOne();
    res.json({ message: "Laporan berjaya dipadam." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
