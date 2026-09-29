"use client";
import { useEffect } from "react";

const interventionLabels = {
  kaunseling: "Kaunseling Kehadiran",
  klinik: "Klinik Akademik",
  softskills: "Pembangunan Soft Skills",
};

function formatAppointmentDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d)) return "-";
  return d.toLocaleString("ms-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AppointmentDetail({ appointment }) {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Jenis", value: interventionLabels[appointment.interventionType] || appointment.interventionType || "-" },
          { label: "Tarikh", value: formatAppointmentDate(appointment.scheduledDate) },
          { label: "Status", value: appointment.status || "-" },
          { label: "Keutamaan", value: appointment.priority === "urgent" ? "Segera" : "Biasa" },
          { label: "Kaunselor", value: appointment.counselorId || "-" },
          { label: "Disediakan Oleh", value: appointment.adminEmail || "-" },
          { label: "Kursus", value: appointment.course || "-" },
          { label: "ID Pelajar", value: appointment.studentId || "-" },
        ].map((item) => (
          <div key={item.label} className="bg-slate-50 p-3 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase">{item.label}</p>
            <p className="font-bold text-sm text-slate-900 break-words">{item.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Sebab Rujukan</h3>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {appointment.reason || "Tiada butiran."}
        </div>
      </div>

      {appointment.counselorNotes && (
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Nota Kaunselor</h3>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
            {appointment.counselorNotes}
          </div>
        </div>
      )}

      {appointment.filePath && (
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Lampiran</h3>
          <a
            href={appointment.filePath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-700 font-medium hover:underline flex items-center gap-1"
          >
            <i className="ph-fill ph-paperclip"></i>
            {appointment.fileName || "Muat Turun Lampiran"}
          </a>
        </div>
      )}
    </div>
  );
}

function ReportDetail({ report, onDownload, onPrint, onShare }) {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Nama", value: report.studentName },
          { label: "No. Matrik", value: report.studentId },
          { label: "CGPA", value: report.cgpa || "-" },
          { label: "Kehadiran", value: `${report.attendance || 0}%` },
          { label: "Kursus", value: report.course || "-" },
          { label: "Semester", value: report.semester || "-" },
          { label: "Risiko", value: report.riskLevel || "-" },
          { label: "Kebolehpasaran", value: `${report.employability || 0}%` },
        ].map((item) => (
          <div key={item.label} className="bg-slate-50 p-3 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase">{item.label}</p>
            <p className="font-bold text-sm text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Mesej</h3>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {report.message || "Tiada mesej."}
        </div>
      </div>

      {report.filePath && (
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">Surat PDF</h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden h-96">
            <iframe
              src={report.filePath}
              className="w-full h-full"
              title={report.fileName || "PDF"}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
        {report.filePath && (
          <>
            <button
              onClick={onDownload}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
            >
              <i className="ph-bold ph-download-simple"></i> Muat Turun
            </button>
            <button
              onClick={onPrint}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
            >
              <i className="ph-bold ph-printer"></i> Cetak
            </button>
          </>
        )}
        <button
          onClick={onShare}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1251AA] text-white hover:bg-[#0C2461] flex items-center gap-2"
        >
          <i className="ph-bold ph-share-network"></i> Kongsi
        </button>
      </div>
    </div>
  );
}

export default function StudentDetailModal({
  kind,
  appointment,
  report,
  item,
  onClose,
  onDownload,
  onPrint,
  onShare,
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const resolvedKind = item?.itemType ?? kind;
  const data = item ?? (resolvedKind === "appointment" ? appointment : report);
  if (!data) return null;

  const title =
    resolvedKind === "appointment"
      ? interventionLabels[data.interventionType] || "Butiran Temujanji"
      : data.title || "Laporan Saya";

  const subtitle =
    resolvedKind === "appointment"
      ? "Temujanji Kaunseling"
      : `${data.authorName || data.authorEmail || ""} • ${data.authorRole === "admin" ? "Penyelaras" : "Kaunselor"}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <i className="ph-bold ph-x text-xl text-slate-500"></i>
          </button>
        </div>

        {resolvedKind === "appointment" ? (
          <AppointmentDetail appointment={data} />
        ) : (
          <ReportDetail
            report={data}
            onDownload={onDownload}
            onPrint={onPrint}
            onShare={onShare}
          />
        )}
      </div>
    </div>
  );
}
