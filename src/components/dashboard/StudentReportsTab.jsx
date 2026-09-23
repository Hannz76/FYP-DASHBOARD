"use client";
import { useState, useEffect } from "react";

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

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-900">{selectedReport.title}</h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <i className="ph-bold ph-x text-xl text-slate-500"></i>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Nama", value: selectedReport.studentName },
                  { label: "No. Matrik", value: selectedReport.studentId },
                  { label: "CGPA", value: selectedReport.cgpa || "-" },
                  { label: "Kehadiran", value: `${selectedReport.attendance || 0}%` },
                  { label: "Kursus", value: selectedReport.course || "-" },
                  { label: "Semester", value: selectedReport.semester || "-" },
                  { label: "Risiko", value: selectedReport.riskLevel || "-" },
                  { label: "Kebolehpasaran", value: `${selectedReport.employability || 0}%` },
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
                  {selectedReport.message || "Tiada mesej."}
                </div>
              </div>

              {selectedReport.filePath && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Surat PDF</h3>
                  <div className="border border-slate-200 rounded-xl overflow-hidden h-96">
                    <iframe
                      src={selectedReport.filePath}
                      className="w-full h-full"
                      title={selectedReport.fileName || "PDF"}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                {selectedReport.filePath && (
                  <>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
                    >
                      <i className="ph-bold ph-download-simple"></i> Muat Turun
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-2"
                    >
                      <i className="ph-bold ph-printer"></i> Cetak
                    </button>
                  </>
                )}
                <button
                  onClick={handleShare}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1251AA] text-white hover:bg-[#0C2461] flex items-center gap-2"
                >
                  <i className="ph-bold ph-share-network"></i> Kongsi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
