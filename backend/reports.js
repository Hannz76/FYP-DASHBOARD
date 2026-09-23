import { Router } from "express";
import Report from "./models/Report.js";
import { verifyToken, requireAdmin, requireStaff } from "./middleware/authMiddleware.js";

const router = Router();

// POST /api/reports — Admin creates a counselor referral
router.post("/reports", verifyToken, requireAdmin, async (req, res) => {
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
    } = req.body;

    if (!studentId || !studentName || !interventionType || !reason) {
      return res.status(400).json({ message: "Sila lengkapkan semua medan wajib." });
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

    const allowedAdminStatuses = ["pending", "rejected"];
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
