"use client";
import { useState, useEffect } from "react";

export default function ReportFormModal({ isOpen, onClose, student, interventionType }) {
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setPriority("normal");
    }
  }, [isOpen]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setToast({ type: "error", text: "Sila nyatakan sebab rujukan." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.nama,
          course: student.kursus || "",
          cgpa: student.cgpa || "",
          attendance: student.attendance || "",
          riskLevel: student.dropoutRisk || "",
          interventionType,
          reason,
          priority,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal menghantar rujukan");
      }

      setToast({ type: "success", text: "Rujukan kaunseling berjaya dihantar!" });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setToast({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !student) return null;

  const typeLabels = {
    kaunseling: "Kaunseling Kehadiran",
    klinik: "Klinik Akademik",
    softskills: "Pembangunan Soft Skills",
  };

  const typeColors = {
    kaunseling: "red",
    klinik: "orange",
    softskills: "blue",
  };

  const color = typeColors[interventionType] || "blue";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">Set Temujanji</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i className="ph-bold ph-x text-xl text-slate-500"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
            <p className="text-xs text-slate-500">Jenis Intervensi</p>
            <p className={`font-bold text-${color}-700`}>{typeLabels[interventionType]}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Nama</p>
              <p className="font-medium text-slate-900">{student.nama}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">ID Pelajar</p>
              <p className="font-medium text-slate-900">{student.id}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Kursus</p>
              <p className="font-medium text-slate-900">{student.kursus || "-"}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">CGPA</p>
              <p className="font-medium text-slate-900">{student.cgpa || "0.00"}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Kehadiran</p>
              <p className="font-medium text-slate-900">{student.attendance || 0}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Risiko</p>
              <p className="font-medium text-slate-900">{student.dropoutRisk || "-"}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sebab Rujukan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1251AA] focus:border-transparent resize-none"
              placeholder="Terangkan sebab pelajar dirujuk untuk sesi intervensi..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Keutamaan
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPriority("normal")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  priority === "normal"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Biasa
              </button>
              <button
                type="button"
                onClick={() => setPriority("urgent")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                  priority === "urgent"
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <i className="ph-fill ph-warning-circle"></i>
                Segera
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1251AA] text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#0C2461] transition-colors disabled:bg-slate-300 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <i className="ph ph-spinner-gap animate-spin text-lg"></i>
                  Menghantar...
                </>
              ) : (
                "Hantar Rujukan"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-[slideUp_0.3s_ease-out] ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
