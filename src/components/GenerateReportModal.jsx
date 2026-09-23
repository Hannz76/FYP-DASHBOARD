"use client";
import { useState, useEffect } from "react";
import { calculateEmployability } from "@/lib/heuristics";

export default function GenerateReportModal({ isOpen, onClose, student, skillGap }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen && student) {
      setTitle(`Laporan Prestasi ${student.nama}`);
      setMessage("");
      setFile(null);
    }
  }, [isOpen, student]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== "application/pdf") {
        setToast({ type: "error", text: "Hanya fail PDF dibenarkan." });
        return;
      }
      if (selected.size > 5 * 1024 * 1024) {
        setToast({ type: "error", text: "Saiz fail maksimum 5MB." });
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setToast({ type: "error", text: "Tajuk laporan diperlukan." });
      return;
    }
    if (!message.trim() && !file) {
      setToast({ type: "error", text: "Sila isi mesej atau lampirkan PDF." });
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
      formData.append("semester", student.semester || "");
      formData.append("ploScores", JSON.stringify(
        skillGap?.chart?.labels?.map((label, i) => ({
          label,
          value: skillGap.chart.current[i] || 0,
        })) || []
      ));
      formData.append("employability", calculateEmployability(student.cgpa, student.attendance));
      formData.append("title", title);
      formData.append("message", message);
      if (file) formData.append("file", file);

      const res = await fetch("/api/student-reports", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal menjana laporan");
      }

      setToast({ type: "success", text: "Laporan dijana & dihantar kepada pelajar!" });
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

  const employability = calculateEmployability(student.cgpa, student.attendance);
  const reportType = message.trim() && file ? "full" : file ? "letter" : "message";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-in-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-900">Jana Laporan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i className="ph-bold ph-x text-xl text-slate-500"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Auto-generated Student Data Preview */}
          <div className="bg-gradient-to-br from-[#0C2461] to-[#1251AA] rounded-xl p-5 text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-80 mb-3">
              Data Pelajar (Auto-Jana)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs opacity-70">Nama</p>
                <p className="font-bold text-sm truncate">{student.nama}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">ID</p>
                <p className="font-bold text-sm">{student.id}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Kursus</p>
                <p className="font-bold text-sm">{student.kursus}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Semester</p>
                <p className="font-bold text-sm">{student.semester || "-"}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">CGPA</p>
                <p className="font-bold text-sm">{student.cgpa || "0.00"}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Kehadiran</p>
                <p className="font-bold text-sm">{student.attendance || 0}%</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Risiko</p>
                <p className="font-bold text-sm">{student.dropoutRisk || "-"}</p>
              </div>
              <div>
                <p className="text-xs opacity-70">Kebolehpasaran</p>
                <p className="font-bold text-sm">{employability}%</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tajuk Laporan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1251AA] focus:border-transparent"
                placeholder="Cth: Laporan Prestasi Semester 3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mesej kepada Pelajar
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1251AA] focus:border-transparent resize-none"
                placeholder="Tulis mesej, nasihat, atau cadangan penambahbaikan untuk pelajar..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Lampiran Surat (PDF - Max 5MB)
              </label>
              {!file ? (
                <label className="w-full flex flex-col items-center justify-center h-28 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                  <i className="ph-fill ph-upload-simple text-2xl text-slate-400"></i>
                  <span className="text-xs text-slate-500 mt-1">
                    Klik untuk memilih fail PDF
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <i className="ph-fill ph-file-pdf text-xl"></i>
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-slate-400">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <i className="ph-bold ph-x text-lg"></i>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-400">
                Jenis: {reportType === "full" ? "Mesej + Surat" : reportType === "letter" ? "Surat PDF" : "Mesej"}
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1251AA] text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-[#0C2461] transition-colors disabled:bg-slate-300 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <i className="ph ph-spinner-gap animate-spin text-lg"></i>
                    Menjana...
                  </>
                ) : (
                  "Jana & Hantar"
                )}
              </button>
            </div>
          </form>
        </div>
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
