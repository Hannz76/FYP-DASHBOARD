"use client";
import { useState, useEffect } from "react";

const statusLabels = {
  pending: "Menunggu",
  accepted: "Diterima",
  scheduled: "Dijadualkan",
  completed: "Selesai",
  rejected: "Ditolak",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  accepted: "bg-blue-100 text-blue-700 border-blue-200",
  scheduled: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const priorityColors = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  normal: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function CounselorDashboardClient() {
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "scheduled") return r.status === "scheduled";
    if (activeTab === "completed") return r.status === "completed";
    return true;
  });

  const counts = {
    pending: reports.filter((r) => r.status === "pending").length,
    scheduled: reports.filter((r) => r.status === "scheduled").length,
    completed: reports.filter((r) => r.status === "completed").length,
    total: reports.length,
  };

  const updateReport = async (id, update) => {
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("Update gagal");
      await fetchReports();
      setSelectedReport(null);
      setScheduleDate("");
      setNotes("");
      setToast({ type: "success", text: "Status laporan dikemas kini." });
    } catch (err) {
      setToast({ type: "error", text: err.message });
    }
  };

  const openScheduleModal = (report) => {
    setSelectedReport({ ...report, action: "schedule" });
    setScheduleDate("");
  };

  const openCompleteModal = (report) => {
    setSelectedReport({ ...report, action: "complete" });
    setNotes(report.counselorNotes || "");
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        Memuatkan laporan kaunselor...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease-in-out]">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pengurusan Rujukan Kaunselor</h2>
        <p className="text-slate-500 text-sm mt-1">
          Pantau dan urus rujukan pelajar dari penyelaras.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Menunggu", value: counts.pending, color: "bg-yellow-500" },
          { label: "Dijadualkan", value: counts.scheduled, color: "bg-purple-500" },
          { label: "Selesai", value: counts.completed, color: "bg-green-500" },
          { label: "Jumlah", value: counts.total, color: "bg-blue-500" },
        ].map((c) => (
          <div key={c.label} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "pending", label: "Laporan Menunggu" },
          { id: "scheduled", label: "Temujanji Dijadualkan" },
          { id: "completed", label: "Selesai" },
          { id: "all", label: "Semua Laporan" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-[#0C2461] text-white"
                : "bg-white text-[#5A6A85] hover:bg-gray-50 border border-[rgba(18,81,170,0.13)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredReports.length === 0 ? (
        <div className="bg-white border border-[rgba(18,81,170,0.13)] rounded-xl p-12 text-center">
          <i className="ph ph-smiley-sad text-5xl text-[#5A6A85] mb-4"></i>
          <h3 className="text-lg font-medium text-[#0A1628]">Tiada laporan dijumpai</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => (
            <div key={report._id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    report.riskLevel === "Tinggi" || report.riskLevel === "Bermasalah"
                      ? "bg-red-500"
                      : report.riskLevel === "Rendah" || report.riskLevel === "Cemerlang"
                      ? "bg-green-500"
                      : "bg-amber-500"
                  }`}>
                    {report.studentName?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{report.studentName}</h3>
                    <p className="text-xs text-slate-500">{report.studentId} • {report.course || "-"}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${priorityColors[report.priority]}`}>
                  {report.priority === "urgent" ? "Segera" : "Biasa"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <p className="text-slate-500">CGPA</p>
                  <p className="font-bold text-slate-900">{report.cgpa || "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <p className="text-slate-500">Kehadiran</p>
                  <p className="font-bold text-slate-900">{report.attendance || "-"}%</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <p className="text-slate-500">Risiko</p>
                  <p className="font-bold text-slate-900">{report.riskLevel || "-"}</p>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">Sebab Rujukan</p>
                <p className="text-sm text-slate-700 line-clamp-3">{report.reason}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${statusColors[report.status]}`}>
                  {statusLabels[report.status]}
                </span>
                <div className="flex gap-2">
                  {report.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateReport(report._id, { status: "accepted" })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Terima
                      </button>
                      <button
                        onClick={() => updateReport(report._id, { status: "rejected" })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  {report.status === "accepted" && (
                    <button
                      onClick={() => openScheduleModal(report)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Jadualkan
                    </button>
                  )}
                  {report.status === "scheduled" && (
                    <button
                      onClick={() => openCompleteModal(report)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                    >
                      Selesai
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {selectedReport?.action === "schedule" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Jadualkan Temujanji</h3>
            <p className="text-sm text-slate-500 mb-4">
              {selectedReport.studentName} ({selectedReport.studentId})
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tarikh & Masa
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm mb-4"
              required
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={() => updateReport(selectedReport._id, { status: "scheduled", scheduledDate: scheduleDate })}
                disabled={!scheduleDate}
                className="px-4 py-2 rounded-lg text-sm bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:bg-slate-300"
              >
                Sahkan Temujanji
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {selectedReport?.action === "complete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tanda Selesai</h3>
            <p className="text-sm text-slate-500 mb-4">
              {selectedReport.studentName} ({selectedReport.studentId})
            </p>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nota Sesi
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm mb-4 resize-none"
              placeholder="Catatkan perkembangan dan cadangan sesi..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                onClick={() => updateReport(selectedReport._id, { status: "completed", counselorNotes: notes })}
                className="px-4 py-2 rounded-lg text-sm bg-green-600 text-white font-bold hover:bg-green-700"
              >
                Tanda Selesai
              </button>
            </div>
          </div>
        </div>
      )}

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
