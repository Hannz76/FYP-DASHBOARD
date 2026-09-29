import { useCallback, useEffect, useState } from "react";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function useFilePreview({
  acceptTypes = ["application/pdf", "image/jpeg", "image/png"],
  maxBytes = MAX_ATTACHMENT_BYTES,
} = {}) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clear = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
    setError(null);
  }, []);

  const selectFile = useCallback(
    (selected) => {
      setError(null);
      if (!selected) return clear();

      const extOk = /\.(pdf|jpe?g|png)$/i.test(selected.name || "");
      if (!acceptTypes.includes(selected.type) && !extOk) {
        setFile(null);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setError("Format tidak disokong. Gunakan PDF, JPG atau PNG.");
        return;
      }
      if (selected.size > maxBytes) {
        setFile(null);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setError(`Saiz fail melebihi had 5MB (${formatFileSize(selected.size)}).`);
        return;
      }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(selected);
      });
      setFile(selected);
    },
    [acceptTypes, maxBytes, clear]
  );

  return { file, previewUrl, error, selectFile, clear };
}
