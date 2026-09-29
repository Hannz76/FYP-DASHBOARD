"use client";

const TONES = {
  blue: { grad: "from-blue-500 to-indigo-600", soft: "bg-blue-50 text-blue-600", badge: "bg-blue-100 text-blue-800" },
  purple: { grad: "from-purple-500 to-fuchsia-600", soft: "bg-purple-50 text-purple-600", badge: "bg-purple-100 text-purple-800" },
  green: { grad: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 text-emerald-600", badge: "bg-emerald-100 text-emerald-800" },
  amber: { grad: "from-amber-500 to-orange-600", soft: "bg-amber-50 text-amber-600", badge: "bg-amber-100 text-amber-800" },
  rose: { grad: "from-rose-500 to-red-600", soft: "bg-rose-50 text-rose-600", badge: "bg-rose-100 text-rose-700" },
  slate: { grad: "from-slate-500 to-slate-700", soft: "bg-slate-100 text-slate-600", badge: "bg-slate-200 text-slate-700" },
};

export const Badge = ({ tone = "slate", children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${TONES[tone]?.badge ?? TONES.slate.badge}`}>
    {children}
  </span>
);

export const StatCard = ({ icon, label, value, tone = "blue" }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TONES[tone]?.grad ?? TONES.blue.grad} text-white shadow`}>
      <i className={`ph ${icon} text-xl`} />
    </span>
    <div className="min-w-0">
      <p className="text-2xl font-extrabold leading-tight text-slate-900">{value ?? 0}</p>
      <p className="truncate text-xs font-medium text-slate-500">{label}</p>
    </div>
  </div>
);

export const SectionCard = ({ icon, title, subtitle, actions, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow">
          <i className={`ph ${icon} text-lg`} />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </header>
    <div className="space-y-4 p-6">{children}</div>
  </section>
);

export const PillTabs = ({ tabs, active, onChange, ariaLabel = "Tab" }) => (
  <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5">
    {tabs.map((t) => {
      const on = t.id === active;
      return (
        <button
          key={t.id}
          role="tab"
          aria-selected={on}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            on ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
          }`}
        >
          {t.icon && <i className={`ph ${t.icon}`} />}
          {t.label}
          {typeof t.count === "number" && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{t.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

export const EmptyState = ({ icon = "ph-tray", title, message }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <i className={`ph ${icon} text-3xl text-slate-400`} />
    <p className="mt-2 text-sm font-semibold text-slate-700">{title}</p>
    {message && <p className="text-xs text-slate-500">{message}</p>}
  </div>
);

export const SkeletonList = ({ rows = 3 }) => (
  <div className="space-y-3" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
  </div>
);

export const formatMsDate = (value, withTime = false) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ms-MY", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  });
};
