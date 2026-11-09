"use client";

import { useEffect, useId, useRef, useState } from "react";
import JobCard from "./JobCard";
import { EmptyState, SkeletonList } from "@/components/ui/dashboard-kit";

const emptyMessages = {
  "no-history": ["Belum ada sejarah carian kursus hari ini", "Mulakan carian untuk pilihan anda. Hasilnya boleh digunakan oleh pelajar dalam kursus yang sama."],
  "no-relevant-jobs": ["Belum ada hasil yang sesuai", "Hasil tersimpan belum mempunyai padanan bidang yang sesuai. Cuba carian untuk pilihan anda."],
  "requirements-exclude-all": ["Tiada hasil memenuhi lokasi wajib anda", "Ubah pilihan lokasi jika anda mahu meluaskan carian. Lokasi wajib tidak dilonggarkan secara automatik."],
  "unmapped-course": ["Pemetaan kerjaya kursus belum tersedia", "Gunakan Carian Manual sementara pemetaan bidang kerjaya kursus anda disemak."],
};

export default function CareerRecommendations({ active, scope, department, preferences, onPreferencesChange, refreshKey, onSearch, jobCardProps }) {
  const inputId = useId();
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([scope, department, preferences.roleFamilyId, preferences.placeId, preferences.placeMode]);
  const currentKey = useRef(requestKey);
  currentKey.current = requestKey;

  useEffect(() => {
    if (!active || !department) return;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && currentKey.current === requestKey;
    setLoadingKey(requestKey);
    setError(null);
    async function loadRecommendations() {
      try {
        const params = new URLSearchParams();
        if (preferences.roleFamilyId) params.set("roleFamilyId", preferences.roleFamilyId);
        if (preferences.placeId) {
          params.set("placeId", preferences.placeId);
          params.set("placeMode", preferences.placeMode);
        }
        const res = await fetch(`/api/careers/recommendations${params.size ? `?${params}` : ""}`, { signal: controller.signal, cache: "no-store" });
        const data = await res.json();
        if (!isCurrent()) return;
        if (!res.ok || !data.success) throw new Error(data.message || "Cadangan tidak dapat dimuatkan. Sila cuba lagi.");
        if (data.department !== department) throw new Error("Kursus pelajar telah berubah. Muat semula profil anda.");
        if (!Number.isFinite(data.resetAt) || data.resetAt <= Date.now()) throw new Error("Cadangan harian telah ditetapkan semula. Muat semula cadangan.");
        setResponse({ scope, key: requestKey, data });
      } catch (cause) {
        if (isCurrent()) {
          setError({ key: requestKey, message: cause.message || "Cadangan tidak dapat dimuatkan. Sila cuba lagi." });
        }
      } finally {
        if (isCurrent()) setLoadingKey(null);
      }
    }
    loadRecommendations();
    return () => controller.abort();
  }, [active, department, scope, requestKey, preferences.roleFamilyId, preferences.placeId, preferences.placeMode, refreshKey, retry]);

  useEffect(() => {
    if (!active) return;
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [active]);

  const resetAt = response?.scope === scope && response.data.department === department ? response.data.resetAt : null;
  useEffect(() => {
    if (!resetAt) return;
    const timeout = setTimeout(() => {
      setResponse(null);
      setRetry((value) => value + 1);
    }, Math.max(0, resetAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [resetAt]);

  if (!active) return null;
  if (!department) return <EmptyState icon="ph-student" title="Rekod kursus diperlukan" message="Cadangan tersedia selepas akaun dipautkan kepada rekod kursus semasa." />;

  const choices = response?.scope === scope && response.data.department === department ? response.data : null;
  const data = response?.key === requestKey && response.data.resetAt > Date.now() ? response.data : null;
  const loading = loadingKey === requestKey;
  const currentError = error?.key === requestKey ? error.message : null;
  const place = choices?.placeChoices?.find((choice) => choice.id === preferences.placeId);
  const groups = data ? [
    [data.mode === "personalized" ? "Cadangan untuk pilihan anda" : "Cadangan mengikut kursus", data.suggestions],
    ["Perlu semakan", data.needsReview],
    ["Iklan lebih lama", data.olderAdvertisements],
  ] : [];
  const hasResults = groups.some(([, items]) => items?.length);
  const emptyMessage = data && !hasResults ? emptyMessages[data.emptyReason] || emptyMessages["no-relevant-jobs"] : null;

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-slate-600">Hasil carian terkini kursus {department}. Pilihan anda menentukan susunan cadangan. Carian pelajar lain tidak mengesahkan kesesuaian jawatan untuk anda.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${inputId}-role`} className="mb-1 block text-sm font-semibold text-slate-700">Bidang kerjaya pilihan</label>
          <select id={`${inputId}-role`} value={preferences.roleFamilyId} onChange={(event) => onPreferencesChange({ ...preferences, roleFamilyId: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm">
            <option value="">Semua bidang kursus</option>
            {(choices?.roleChoices || []).map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${inputId}-place`} className="mb-1 block text-sm font-semibold text-slate-700">Lokasi kerja pilihan</label>
          <select id={`${inputId}-place`} value={preferences.placeId} onChange={(event) => onPreferencesChange({ ...preferences, placeId: event.target.value, placeMode: event.target.value ? preferences.placeMode : "prefer" })} className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm">
            <option value="">Tiada pilihan lokasi</option>
            {(choices?.placeChoices || []).map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" disabled={!preferences.placeId} checked={Boolean(preferences.placeId) && preferences.placeMode === "require"} onChange={(event) => onPreferencesChange({ ...preferences, placeMode: event.target.checked ? "require" : "prefer" })} className="h-4 w-4 accent-blue-600" />
            Lokasi ini wajib
          </label>
        </div>
      </div>
      {!preferences.roleFamilyId && !preferences.placeId && <p className="text-sm text-slate-500">Pilih bidang atau lokasi untuk menyusun cadangan mengikut pilihan anda. Pilihan ini hanya disimpan sepanjang sesi papan pemuka ini.</p>}
      <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)} className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 disabled:opacity-50 touch-target active:scale-95">Muat semula cadangan</button>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? <SkeletonList rows={3} /> : currentError ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{currentError}</div>
        ) : data ? (
          <div className="space-y-6">
            {emptyMessage && <EmptyState icon="ph-briefcase" title={emptyMessage[0]} message={emptyMessage[1]} />}
            {groups.map(([title, items]) => items?.length ? (
              <section key={title} aria-label={title} className="space-y-3">
                <h3 className="font-semibold text-slate-800">{title}</h3>
                {title === "Iklan lebih lama" && <p className="text-sm text-slate-500">Iklan disiarkan lebih 30 hari lalu. Semak sama ada kekosongan masih dibuka.</p>}
                <p className="text-sm text-amber-800">Syarat majikan belum disahkan. Jenis pekerjaan, pengalaman dan kelayakan perlu disemak pada iklan.</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map(({ job, reasons, checksNeeded }, index) => (
                    <div key={job.jobId} className="space-y-2">
                      <JobCard job={job} isDynamic delay={index * 60} {...jobCardProps?.(job)} />
                      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        {reasons?.length > 0 && <><p className="font-semibold text-slate-700">Sebab cadangan</p><ul className="mt-1 list-disc space-y-1 pl-5">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>}
                        {checksNeeded?.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">{checksNeeded.map((check) => <li key={check}>{check}</li>)}</ul>}
                        {!job.postedAt && <p className="mt-2">Tarikh iklan tidak dinyatakan.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null)}
            {data.starterSearches?.length > 0 && <div className="space-y-2 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-500">Carian baharu hanya bermula apabila anda memilih butang carian.</p>
              <div className="flex flex-wrap gap-2">{data.starterSearches.map((search, index) => <button key={`${search.q}-${search.location}`} type="button" onClick={() => onSearch({ ...search, location: place?.label || search.location })} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 touch-target active:scale-95">{index === 0 ? "Cari jawatan untuk pilihan saya" : search.label}</button>)}</div>
            </div>}
            {data.emptyReason === "unmapped-course" && <button type="button" onClick={() => onSearch(null)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white touch-target active:scale-95">Buka Carian Manual</button>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
