"use client";

import { useEffect, useRef, useState } from "react";
import { EmptyState, SkeletonList, formatMsDate } from "@/components/ui/dashboard-kit";

const levels = { introductory: "Pengenalan", intermediate: "Pertengahan", advanced: "Lanjutan" };
const languages = { en: "Bahasa Inggeris", ms: "Bahasa Melayu" };

function resourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function LearningCard({ item }) {
  const { resource, action, reasons = [], notes = [] } = item;
  const url = resourceUrl(action?.url);
  const access = resource.publication?.access;
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-blue-700">{resource.provider}</p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">{resource.title}</h3>
      <p className="mt-2 text-sm text-slate-600">{levels[resource.level] || "Tahap tidak dinyatakan"} · {resource.languages?.length ? resource.languages.map((language) => languages[language] || language).join(", ") : "Bahasa tidak dinyatakan"}</p>
      <p className="mt-1 text-sm text-slate-500">{Number.isFinite(resource.durationMinutes) && resource.durationMinutes > 0 ? `${resource.durationMinutes} minit` : "Tempoh tidak dinyatakan"}</p>
      <p className="mt-3 text-sm font-semibold text-emerald-700">{access?.kind === "free-open" ? "Akses percuma" : access?.kind === "free-account" ? "Percuma dengan akaun penyedia" : "Semak syarat akses di laman penyedia"}</p>
      {access?.note && <p className="mt-1 text-sm text-slate-600">{access.note}</p>}
      {reasons.length > 0 && <div className="mt-4 text-sm text-slate-600"><p className="font-semibold text-slate-800">Sebab cadangan</p><ul className="mt-1 list-disc space-y-1 pl-5">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      {resource.prerequisites?.length > 0 && <p className="mt-3 text-sm text-slate-600">Syarat awal: {resource.prerequisites.join("; ")}</p>}
      {resource.credentialNote && <p className="mt-3 text-sm text-slate-500">{resource.credentialNote}</p>}
      {notes.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-500">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      {resource.publication?.checkedAt && <p className="mt-3 text-xs text-slate-400">Sumber disemak {formatMsDate(resource.publication.checkedAt)}.</p>}
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${action.label} untuk ${resource.title} (tab baharu)`} className="mt-5 block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 touch-target active:scale-95">{action.label}</a> : <p className="mt-5 text-sm text-amber-800">Pautan pembelajaran tidak tersedia.</p>}
    </article>
  );
}

export default function LearningRecommendations({ scope, displayedDataset }) {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const currentScope = useRef(scope);
  currentScope.current = scope;

  useEffect(() => {
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && currentScope.current === scope;
    setResult({ scope, status: "loading" });
    async function load() {
      try {
        const response = await fetch("/api/courses/recommendations", { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!isCurrent()) return;
        if (!response.ok || !data.success) throw new Error(data.message || "Bahan pembelajaran tidak dapat dimuatkan. Sila cuba lagi.");
        if (typeof data.department !== "string" || !data.department || typeof data.dataset !== "string" || !data.dataset || !Array.isArray(data.courses) || !Array.isArray(data.ebooks) || !Array.isArray(data.notices)) throw new Error("Maklumat cadangan tidak lengkap. Sila cuba lagi.");
        setResult({ scope, status: "ready", data });
      } catch (cause) {
        if (isCurrent()) setResult({ scope, status: "error", message: cause.message || "Bahan pembelajaran tidak dapat dimuatkan. Sila cuba lagi." });
      }
    }
    load();
    return () => controller.abort();
  }, [scope, retry]);

  const state = result?.scope === scope ? result : null;
  const data = state?.status === "ready" ? state.data : null;
  const loading = !state || state.status === "loading";
  const hasResources = data && data.courses.length + data.ebooks.length > 0;
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Kursus Cadangan (Personalized)</h1>
        <p className="text-sm text-slate-600">Bahan pembelajaran mengikut rekod kursus semasa anda. Pendaftaran dan pembelajaran berlangsung di laman penyedia.</p>
      </header>
      <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)} className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 disabled:opacity-50 touch-target active:scale-95">Muat semula bahan</button>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? <SkeletonList rows={3} /> : state.status === "error" ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{state.message}</div> : data ? (
          <div className="space-y-6">
            <section aria-label="Asas cadangan pembelajaran" className="space-y-2 rounded-xl bg-blue-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">{data.mode === "enrichment" ? "Bahan pengayaan" : data.mode === "reviewed-gaps" ? "Cadangan berdasarkan keperluan pembelajaran anda" : "Cadangan berdasarkan kursus anda"}</p>
              <p>Rekod semasa: {data.department} · {data.dataset}.</p>
              {displayedDataset && displayedDataset !== data.dataset && <p>Dataset akademik yang dipaparkan ialah {displayedDataset}. Cadangan ini menggunakan rekod semasa {data.dataset}.</p>}
              {data.notices.map((notice) => <p key={notice}>{notice}</p>)}
              {data.assessment?.gaps?.length > 0 && <p>Skor direkodkan di bawah sasaran {data.assessment.target}: {data.assessment.gaps.map(({ plo, score }) => `PLO ${plo}: ${score}`).join(", ")}. Skor sahaja tidak menentukan topik kursus.</p>}
            </section>
            {!hasResources && <EmptyState icon="ph-books" title="Bahan berkaitan belum tersedia" message="Katalog belum mempunyai bahan percuma yang sesuai untuk kursus anda. Semak semula kemudian." />}
            {[["Kursus dan modul", data.courses], ["E-buku dan bacaan", data.ebooks]].map(([title, items]) => items.length > 0 ? (
              <section key={title} aria-label={title} className="space-y-3">
                <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <LearningCard key={item.resource.id} item={item} />)}</div>
              </section>
            ) : null)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
