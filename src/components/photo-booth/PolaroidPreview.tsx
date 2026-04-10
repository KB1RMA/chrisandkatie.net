'use client';

import React, { useState, useEffect } from 'react';
import { PolaroidCard } from '@/components/photo-booth/PolaroidCard';

type PolaroidPreviewProps = {
  blob: Blob;
  onRetake: () => void;
  onConfirm: (result: {
    id: string;
    publicUrl: string;
    uploadedAt: string;
  }) => void;
  onError: (message: string) => void;
};

/**
 * Polaroid-style preview component shown after capturing a photo.
 *
 * Converts the captured blob to a data URL for display, then handles
 * upload confirmation by POSTing to the upload API route.
 *
 * @param blob - The captured image blob to preview and upload.
 * @param onRetake - Callback to discard the preview and return to the viewfinder.
 * @param onConfirm - Callback invoked on successful upload with the server response.
 * @param onError - Callback invoked with an error message when upload fails.
 * @returns The polaroid preview UI.
 */
export function PolaroidPreview({
  blob,
  onRetake,
  onConfirm,
  onError,
}: PolaroidPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Convert blob to data URL for display
  useEffect(() => {
    const reader = new FileReader();

    reader.onload = () => {
      setDataUrl(reader.result as string);
    };

    reader.readAsDataURL(blob);
  }, [blob]);

  /**
   * Uploads the captured photo to the API and calls the appropriate callback.
   */
  const handleConfirm = async () => {
    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.append('photo', blob, 'photo.jpg');
      formData.append('takenAt', new Date().toISOString());

      const response = await fetch('/api/photo-booth/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          body?.error === 'MISSING_FILE'
            ? 'No photo was included. Please try again.'
            : body?.error === 'INVALID_MIME'
              ? 'Invalid file type. Please use a photo.'
              : body?.error === 'FILE_TOO_LARGE'
                ? 'Photo is too large (max 10 MB).'
                : 'Upload failed. Please try again.';

        onError(message);

        return;
      }

      const result = (await response.json()) as {
        id: string;
        publicUrl: string;
        uploadedAt: string;
      };

      onConfirm(result);
    } catch {
      onError('Upload failed. Please check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <h2 className="text-lg font-semibold text-[#6a5555]">Looking good? 🎉</h2>

      {dataUrl && (
        <div className="flex justify-center px-4">
          <PolaroidCard src={dataUrl} alt="Your captured photo" index={0} />
        </div>
      )}

      {!dataUrl && (
        <div
          className="h-64 w-48 animate-pulse rounded bg-[#f3dedb]"
          aria-label="Loading preview…"
        />
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={onRetake}
          disabled={isUploading}
          className="min-h-[48px] min-w-[120px] rounded-full border-2 border-[#9e3f3f] px-8 py-3 text-base font-semibold text-[#9e3f3f] transition hover:bg-[#fff0ee] disabled:opacity-60"
        >
          🔄 Retake
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isUploading || !dataUrl}
          className="min-h-[48px] min-w-[160px] rounded-full bg-[#9e3f3f] px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#7a2e2e] disabled:opacity-60"
        >
          {isUploading ? 'Uploading…' : '✅ Share Photo'}
        </button>
      </div>
    </div>
  );
}
