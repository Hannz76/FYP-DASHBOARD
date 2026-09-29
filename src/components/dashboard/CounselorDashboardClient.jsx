"use client";
import { useState, useEffect } from "react";
import AppointmentCalendar from "./AppointmentCalendar";
import {
  StatCard,
  PillTabs,
  Badge,
  EmptyState,
} from "../ui/dashboard-kit";

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
  const [activeTab, setActiveTab] = useState("calendar");
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="ph-hourglass-medium" label="Menunggu" value={counts.pending} tone="amber" />
        <StatCard icon="ph-calendar-blank" label="Dijadualkan" value={counts.scheduled} tone="blue" />
        <StatCard icon="ph-check-circle" label="Selesai" value={counts.completed} tone="green" />
        <StatCard icon="ph-stack" label="Jumlah Rujukan" value={counts.total} tone="purple" />
      </div>

      <PillTabs
        ariaLabel="Mod paparan kaunselor"
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "pending", label: "Menunggu", icon: "ph-hourglass-medium", count: counts.pending },
          { id: "scheduled", label: "Dijadualkan", icon: "ph-calendar-blank", count: counts.scheduled },
          { id: "calendar", label: "Kalendar", icon: "ph-calendar-dots" },
          { id: "completed", label: "Selesai", icon: "ph-check-circle", count: counts.completed },
          { id: "all", label: "Semua", icon: "ph-rows", count: counts.total },
        ]}
      />

      {activeTab === "calendar" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <AppointmentCalendar
            reports={reports.filter((r) => r.status === "scheduled" && r.scheduledDate)}
            onComplete={openCompleteModal}
          />
        </section>
      ) : filteredReports.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmptyState icon="ph-chats-circle" title="Tiada rujukan" message="Tiada rekod untuk tab ini." />
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ul className="space-y-3">
            {filteredReports.map((report) => (
              <li key={report._id}>
                <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md lg:flex-row lg:items-center">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <i
                      className={`ph text-xl ${
                        report.interventionType === "klinik"
                          ? "ph-first-aid-kit"
                          : report.interventionType === "softskills"
                            ? "ph-users-three"
                            : "ph-chats-circle"
                      }`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">{report.interventionType}</Badge>
                      <Badge tone={report.status === "completed" ? "green" : report.status === "scheduled" ? "purple" : report.status === "pending" ? "amber" : "rose"}>
                        {statusLabels[report.status] ?? report.status}
                      </Badge>
                      <Badge tone={report.priority === "urgent" ? "rose" : "slate"}>
                        {report.priority === "urgent" ? "Segera" : "Biasa"}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 truncate text-sm font-bold text-slate-900">
                      {report.studentName} <span className="font-medium text-slate-400">• {report.studentId}</span>
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{report.reason}</p>
                    {report.filePath && (
                      <a
                        href={report.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 font-medium hover:underline flex items-center gap-1 mt-2"
                      >
                        <i className="ph-fill ph-paperclip"></i>
                        {report.fileName || "Muat Turun Lampiran"}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
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
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Schedule Modal */}
      {selectedReport?.action === "schedule" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain p-6 [@supports(height:100dvh)]:max-h-[90dvh]">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain p-6 [@supports(height:100dvh)]:max-h-[90dvh]">
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
