"use client";
import { useState, useEffect, useRef } from "react";
import { useFilePreview } from "@/lib/use-file-preview";
import AttachmentPreview from "@/components/ui/AttachmentPreview";

export default function ReportFormModal({ isOpen, onClose, student, interventionType }) {
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("normal");
  const [scheduledDate, setScheduledDate] = useState("");
  const [counselorId, setCounselorId] = useState("");
  const [counselors, setCounselors] = useState([]);
  const lampiran = useFilePreview();
  const fileInputRef = useRef(null);
  const file = lampiran.file;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setPriority("normal");
      setScheduledDate("");
      setCounselorId("");
      lampiran.clear();
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetch("/api/auth/users")
        .then((res) => (res.ok ? res.json() : []))
        .then((users) =>
          setCounselors(Array.isArray(users) ? users.filter((u) => u.role === "counselor") : [])
        )
        .catch(() => setCounselors([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || !scheduledDate || !counselorId) {
      setToast({ type: "error", text: "Sila lengkapkan sebab, tarikh temujanji dan kaunselor." });
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setToast({ type: "error", text: "Saiz fail melebihi 5MB." });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("studentId", student.id);
      formData.append("studentName", student.nama);
      formData.append("course", student.kursus || "");
      formData.append("cgpa", student.cgpa || "");
      formData.append("attendance", student.attendance || "");
      formData.append("riskLevel", student.dropoutRisk || "");
      formData.append("interventionType", interventionType);
      formData.append("reason", reason);
      formData.append("priority", priority);
      formData.append("scheduledDate", scheduledDate);
      formData.append("counselorId", counselorId);
      if (file) formData.append("file", file);

      const res = await fetch("/api/reports", {
        method: "POST",
        body: formData,
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

  const typeStyles = {
    kaunseling: { box: "bg-red-50 border-red-100", text: "text-red-700" },
    klinik: { box: "bg-orange-50 border-orange-100", text: "text-orange-700" },
    softskills: { box: "bg-blue-50 border-blue-100", text: "text-blue-700" },
  };
  const style = typeStyles[interventionType] ?? typeStyles.kaunseling;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in-out]">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl [@supports(height:100dvh)]:max-h-[90dvh]">
        <div className="shrink-0 border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl bg-white">
          <h2 className="text-lg font-bold text-slate-900">Set Temujanji</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i className="ph-bold ph-x text-xl text-slate-500"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
            <div className={`${style.box} border rounded-xl p-4`}>
              <p className="text-xs text-slate-500">Jenis Intervensi</p>
              <p className={`font-bold ${style.text}`}>{typeLabels[interventionType] ?? interventionType}</p>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tarikh & Masa Temujanji <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledDate}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1251AA] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kaunselor <span className="text-red-500">*</span>
            </label>
            <select
              value={counselorId}
              onChange={(e) => setCounselorId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1251AA] focus:border-transparent bg-white"
              required
            >
              <option value="">— Pilih Kaunselor —</option>
              {counselors.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.displayName || c.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="lampiran">
              Lampiran (PDF/JPG/PNG, maks 5MB)
            </label>
            <input
              id="lampiran"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => lampiran.selectFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
            {lampiran.error && (
              <p className="mt-1 text-xs text-rose-600">{lampiran.error}</p>
            )}
            <AttachmentPreview
              file={lampiran.file}
              previewUrl={lampiran.previewUrl}
              onRemove={() => {
                lampiran.clear();
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
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
          </div>

          <div className="shrink-0 rounded-b-2xl border-t border-slate-100 bg-white px-6 py-4 flex justify-end gap-3">
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
