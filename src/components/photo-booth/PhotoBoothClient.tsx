'use client';

import React, { useState } from 'react';
import { PhotoBoothCapture } from '@/components/photo-booth/PhotoBoothCapture';
import { PolaroidPreview } from '@/components/photo-booth/PolaroidPreview';
import { PolaroidCard } from '@/components/photo-booth/PolaroidCard';

type UploadResult = {
  id: string;
  publicUrl: string;
  uploadedAt: string;
};

type BoothState = 'viewfinder' | 'preview' | 'success' | 'error';

type PhotoBoothClientProps = {
  /** The event ID to associate uploaded photos with. */
  eventId: string;
};

/**
 * Client-side state machine for the photo booth flow.
 *
 * Manages transitions between viewfinder, preview, success, and error states
 * and composes the appropriate child components for each state.
 *
 * @returns The photo booth state machine UI.
 */
export function PhotoBoothClient({ eventId }: PhotoBoothClientProps) {
  const [state, setState] = useState<BoothState>('viewfinder');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapture = (blob: Blob) => {
    setCapturedBlob(blob);
    setState('preview');
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setState('viewfinder');
  };

  const handleConfirm = (result: UploadResult) => {
    setUploadResult(result);
    setState('success');
  };

  const handleError = (message: string) => {
    setErrorMessage(message);
    setState('error');
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setCapturedBlob(null);
    setState('viewfinder');
  };

  if (state === 'viewfinder') {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        <p className="max-w-sm text-center text-[#6a5555]">
          Strike a pose and capture your moment! 📸
        </p>
        <PhotoBoothCapture onCapture={handleCapture} />
      </div>
    );
  }

  if (state === 'preview' && capturedBlob) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        <PolaroidPreview
          blob={capturedBlob}
          eventId={eventId}
          onRetake={handleRetake}
          onConfirm={handleConfirm}
          onError={handleError}
        />
      </div>
    );
  }

  if (state === 'success' && uploadResult) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        <h2 className="text-2xl font-bold text-[#9e3f3f]">Photo shared! 🎉</h2>
        <p className="text-center text-[#6a5555]">
          Your photo just appeared in the album below!
        </p>
        <div className="flex justify-center">
          <PolaroidCard
            src={uploadResult.publicUrl}
            alt="Your shared photo"
            index={0}
          />
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="min-h-[48px] min-w-[140px] rounded-full border-2 border-[#9e3f3f] px-8 py-3 text-base font-semibold text-[#9e3f3f] transition hover:bg-[#fff0ee]"
        >
          📸 Take Another
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-8">
        <h2 className="text-2xl font-bold text-[#9e3f3f]">
          Something went wrong
        </h2>
        {errorMessage && (
          <p className="max-w-sm text-center text-[#6a5555]">{errorMessage}</p>
        )}
        <button
          type="button"
          onClick={handleRetry}
          className="min-h-[48px] min-w-[160px] rounded-full bg-[#9e3f3f] px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#7a2e2e]"
        >
          🔄 Try Again
        </button>
      </div>
    );
  }

  return null;
}
