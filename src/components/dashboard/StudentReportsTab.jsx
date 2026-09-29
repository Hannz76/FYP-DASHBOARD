"use client";
import { useState, useEffect } from "react";
import StudentDetailModal from "../StudentDetailModal";

const typeLabels = {
  message: "Mesej",
  letter: "Surat PDF",
  full: "Mesej + Surat",
};

const typeColors = {
  message: "bg-blue-100 text-blue-700 border-blue-200",
  letter: "bg-purple-100 text-purple-700 border-purple-200",
  full: "bg-green-100 text-green-700 border-green-200",
};

const riskColors = {
  Tinggi: "bg-red-100 text-red-700 border-red-200",
  Sederhana: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Rendah: "bg-green-100 text-green-700 border-green-200",
};

export default function StudentReportsTab() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/student-reports");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReport = async (report) => {
    try {
      const res = await fetch(`/api/student-reports/${report._id}`);
      const data = await res.json();
      setSelectedReport(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = () => {
    if (!selectedReport?.filePath) return;
    const link = document.createElement("a");
    link.href = selectedReport.filePath;
    link.download = selectedReport.fileName || "laporan.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!selectedReport?.filePath) return;
    const printWindow = window.open(selectedReport.filePath, "_blank");
    printWindow?.print();
  };

  const handleShare = async () => {
    if (!selectedReport) return;
    const shareData = {
      title: selectedReport.title,
      text: `Laporan: ${selectedReport.title} daripada ${selectedReport.authorName}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Pautan disalin ke papan keratan.");
      }
    } catch {
      // user cancelled
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        Memuatkan laporan...
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-in-out] space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Laporan Saya</h1>
        <p className="text-slate-500">
          Laporan dan surat yang dihantar oleh kakitangan IKMB.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 text-center">
          <i className="ph ph-file-text text-5xl text-slate-400 mb-4"></i>
          <h3 className="text-lg font-medium text-slate-900">Tiada laporan lagi</h3>
          <p className="text-sm text-slate-500 mt-1">
            Laporan daripada penyelaras/kaunselor akan dipaparkan di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <div
              key={report._id}
              className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{report.title}</h3>
                  <p className="text-xs text-slate-500">
                    {report.authorName || report.authorEmail} •{" "}
                    {report.authorRole === "admin" ? "Penyelaras" : "Kaunselor"}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${typeColors[report.reportType]}`}>
                  {typeLabels[report.reportType]}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-slate-500">CGPA</p>
                  <p className="font-bold text-slate-900">{report.cgpa || "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-slate-500">Kehadiran</p>
                  <p className="font-bold text-slate-900">{report.attendance || "-"}%</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-slate-500">Risiko</p>
                  <p className="font-bold text-slate-900">{report.riskLevel || "-"}</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <p className="text-slate-500">Kebolehpasaran</p>
                  <p className="font-bold text-slate-900">{report.employability || 0}%</p>
                </div>
              </div>

              <p className="text-sm text-slate-700 line-clamp-2 mb-3">
                {report.message || "Tiada mesej."}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {new Date(report.createdAt).toLocaleDateString("ms-MY")}
                </span>
                <button
                  onClick={() => handleViewReport(report)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#1251AA] text-white hover:bg-[#0C2461]"
                >
                  Lihat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shared detail modal (same component as Temujanji detail) */}
      {selectedReport && (
        <StudentDetailModal
          kind="report"
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDownload={handleDownload}
          onPrint={handlePrint}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
