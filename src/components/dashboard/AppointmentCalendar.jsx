"use client";
import { useState } from "react";

const typeColors = {
  kaunseling: "bg-red-100 text-red-700 border-red-200",
  klinik: "bg-orange-100 text-orange-700 border-orange-200",
  softskills: "bg-blue-100 text-blue-700 border-blue-200",
};

const typeLabels = {
  kaunseling: "Kaunseling Kehadiran",
  klinik: "Klinik Akademik",
  softskills: "Pembangunan Soft Skills",
};

const DAY_NAMES = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function AppointmentCalendar({ reports, onComplete }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(null);

  // Group appointments by local calendar day
  const byDay = {};
  for (const r of reports) {
    if (!r.scheduledDate) continue;
    const d = new Date(r.scheduledDate);
    if (isNaN(d)) continue;
    const k = dayKey(d);
    (byDay[k] ||= []).push(r);
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  // Monday-first offset: JS getDay() is Sunday-first
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(dayKey(today));
  };

  const monthLabel = currentMonth.toLocaleDateString("ms-MY", {
    month: "long",
    year: "numeric",
  });

  const selectedAppointments = selectedDay ? byDay[selectedDay] || [] : [];

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-900">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Hari Ini
          </button>
          <button
            onClick={prevMonth}
            aria-label="Bulan sebelumnya"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i className="ph-bold ph-caret-left text-slate-600"></i>
          </button>
          <button
            onClick={nextMonth}
            aria-label="Bulan seterusnya"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <i className="ph-bold ph-caret-right text-slate-600"></i>
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((n) => (
          <div
            key={n}
            className="text-center text-[11px] font-bold text-slate-400 uppercase py-1"
          >
            {n}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="min-h-[80px]" />;
          const k = dayKey(date);
          const dayReports = byDay[k] || [];
          const isToday = k === dayKey(today);
          const isSelected = k === selectedDay;
          return (
            <button
              key={k}
              onClick={() => setSelectedDay(isSelected ? null : k)}
              className={`min-h-[80px] rounded-lg border p-1.5 text-left align-top transition-colors ${
                isSelected
                  ? "border-[#1251AA] bg-blue-50/50"
                  : "border-slate-100 hover:bg-slate-50"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full ${
                  isToday
                    ? "bg-[#1251AA] text-white"
                    : "text-slate-600"
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayReports.slice(0, 2).map((r) => (
                  <div
                    key={r._id}
                    className={`text-[10px] font-medium border rounded px-1 py-0.5 truncate ${
                      typeColors[r.interventionType] || typeColors.softskills
                    }`}
                  >
                    {r.priority === "urgent" && (
                      <i className="ph-fill ph-warning-circle mr-0.5"></i>
                    )}
                    {new Date(r.scheduledDate).toLocaleTimeString("ms-MY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {r.studentName}
                  </div>
                ))}
                {dayReports.length > 2 && (
                  <p className="text-[10px] text-slate-400 pl-1">
                    +{dayReports.length - 2} lagi
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-bold text-slate-900 mb-3">
            Temujanji pada{" "}
            {selectedAppointments.length > 0
              ? new Date(selectedAppointments[0].scheduledDate).toLocaleDateString(
                  "ms-MY",
                  { day: "numeric", month: "long", year: "numeric" }
                )
              : ""}
          </h4>
          {selectedAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">Tiada temujanji pada hari ini.</p>
          ) : (
            <div className="space-y-2">
              {selectedAppointments.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {r.studentName}
                      <span className="text-slate-400 font-normal"> • {r.studentId}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(r.scheduledDate).toLocaleTimeString("ms-MY", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      • {typeLabels[r.interventionType] || r.interventionType}
                      {r.priority === "urgent" && (
                        <span className="text-red-600 font-bold"> • Segera</span>
                      )}
                    </p>
                    {r.filePath && (
                      <a
                        href={r.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-700 font-medium hover:underline flex items-center gap-1 mt-1"
                      >
                        <i className="ph-fill ph-paperclip"></i>
                        {r.fileName || "Lampiran"}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => onComplete(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                    Selesai
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
