"use client";
import { useState, useEffect, useMemo } from "react";
import StudentDetailModal from "../StudentDetailModal";
import {
  SectionCard,
  PillTabs,
  Badge,
  EmptyState,
  SkeletonList,
  formatMsDate,
} from "../ui/dashboard-kit";

const interventionLabels = {
  kaunseling: "Kaunseling Kehadiran",
  klinik: "Klinik Akademik",
  softskills: "Pembangunan Soft Skills",
};

export function normalizeLaporanItems(reports, appointments) {
  const normalizedReports = (Array.isArray(reports) ? reports : []).map((r) => ({
    ...r,
    itemType: "report",
    displayTitle: r.title || "Laporan Pelajar",
    displayDate: r.createdAt || null,
  }));
  const normalizedAppointments = (Array.isArray(appointments) ? appointments : []).map((a) => ({
    ...a,
    itemType: "appointment",
    displayTitle: interventionLabels[a.interventionType] || "Temujanji Kaunseling",
    displayDate: a.scheduledDate || null,
  }));
  return [...normalizedReports, ...normalizedAppointments].sort(
    (a, b) => new Date(b.displayDate || 0) - new Date(a.displayDate || 0)
  );
}

export function formatLaporanDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d)) return "-";
  return d.toLocaleDateString("ms-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MergedLaporanTab() {
  const [laporanItems, setLaporanItems] = useState([]);
  const [loadingLaporan, setLoadingLaporan] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [laporanFilter, setLaporanFilter] = useState("all");

  const laporanCounts = useMemo(
    () => ({
      all: laporanItems.length,
      report: laporanItems.filter((i) => i.itemType === "report").length,
      appointment: laporanItems.filter((i) => i.itemType === "appointment").length,
    }),
    [laporanItems]
  );

  const filteredLaporan = useMemo(
    () =>
      laporanFilter === "all"
        ? laporanItems
        : laporanItems.filter((i) => i.itemType === laporanFilter),
    [laporanItems, laporanFilter]
  );

  useEffect(() => {
    const fetchLaporanData = async () => {
      try {
        const [reportsRes, appointmentsRes] = await Promise.all([
          fetch("/api/student-reports"),
          fetch("/api/reports/mine"),
        ]);
        const reports = reportsRes.ok ? await reportsRes.json() : [];
        const appointments = appointmentsRes.ok ? await appointmentsRes.json() : [];
        setLaporanItems(normalizeLaporanItems(reports, appointments));
      } catch (err) {
        console.error("Gagal memuatkan laporan:", err);
        setLaporanItems([]);
      } finally {
        setLoadingLaporan(false);
      }
    };
    fetchLaporanData();
  }, []);

  const handleViewDetails = async (item) => {
    if (item.itemType === "report" && !item.readByStudent) {
      try {
        const res = await fetch(`/api/student-reports/${item._id}`);
        if (res.ok) {
          const updated = await res.json();
          const merged = { ...updated, itemType: "report" };
          setSelectedItem(merged);
          setLaporanItems((prev) =>
            prev.map((i) =>
              i._id === item._id && i.itemType === "report"
                ? { ...i, ...updated, itemType: "report", readByStudent: true }
                : i
            )
          );
          return;
        }
      } catch (err) {
        console.error("Gagal menandakan laporan sebagai dibaca:", err);
      }
    }
    setSelectedItem(item);
  };

  const handleDownload = () => {
    if (!selectedItem?.filePath) return;
    const link = document.createElement("a");
    link.href = selectedItem.filePath;
    link.download = selectedItem.fileName || "laporan.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!selectedItem?.filePath) return;
    window.open(selectedItem.filePath, "_blank")?.print();
  };

  const handleShare = async () => {
    if (!selectedItem) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: selectedItem.displayTitle || selectedItem.title,
          text: `Laporan: ${selectedItem.displayTitle || selectedItem.title}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Pautan disalin ke papan keratan.");
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-in-out] space-y-6">
      <SectionCard
        icon="ph-folder-open"
        title="Laporan Saya"
        subtitle="Laporan staf & temujanji kaunseling dalam satu senarai"
        actions={<Badge tone="blue">{laporanCounts.all} rekod</Badge>}
      >
        <PillTabs
          ariaLabel="Jenis rekod"
          active={laporanFilter}
          onChange={setLaporanFilter}
          tabs={[
            { id: "all", label: "Semua", count: laporanCounts.all },
            { id: "report", label: "Laporan", icon: "ph-file-text", count: laporanCounts.report },
            { id: "appointment", label: "Temujanji", icon: "ph-calendar-blank", count: laporanCounts.appointment },
          ]}
        />

        {loadingLaporan ? (
          <SkeletonList />
        ) : filteredLaporan.length === 0 ? (
          <EmptyState
            icon="ph-folder-open"
            title="Tiada rekod"
            message="Tiada laporan atau temujanji untuk paparan ini."
          />
        ) : (
          <ul className="space-y-3">
            {filteredLaporan.map((item) => {
              const isReport = item.itemType === "report";
              return (
                <li key={`${item.itemType}-${item._id}`}>
                  <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md sm:flex-row sm:items-center">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isReport ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}
                    >
                      <i className={`ph ${isReport ? "ph-file-text" : "ph-calendar-blank"} text-xl`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={isReport ? "blue" : "purple"}>
                          {isReport ? "Laporan" : "Temujanji"}
                        </Badge>
                        {isReport && !item.readByStudent && <Badge tone="rose">Baharu</Badge>}
                        {!isReport && (
                          <Badge tone={item.status === "scheduled" ? "green" : "amber"}>
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-1.5 truncate text-sm font-bold capitalize text-slate-900">
                        {item.displayTitle}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatMsDate(item.displayDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleViewDetails(item)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <i className="ph ph-eye" /> Lihat Butiran
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {selectedItem && (
        <StudentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDownload={handleDownload}
          onPrint={handlePrint}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
