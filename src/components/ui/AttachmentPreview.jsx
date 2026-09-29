"use client";
import { formatFileSize } from "@/lib/use-file-preview";

export default function AttachmentPreview({ file, previewUrl, onRemove }) {
  if (!file || !previewUrl) return null;
  const isPdf = file.type === "application/pdf";

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-600">{file.name}</p>
          <p className="text-[11px] text-slate-400">{formatFileSize(file.size)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Buka
          </a>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700"
          >
            Buang
          </button>
        </div>
      </div>

      {isPdf ? (
        <iframe src={previewUrl} title="Pratonton lampiran PDF" className="h-56 w-full bg-white sm:h-64" />
      ) : (
        <img
          src={previewUrl}
          alt={`Pratonton ${file.name}`}
          className="h-56 w-full bg-slate-50 object-contain sm:h-64"
        />
      )}
    </div>
  );
}
