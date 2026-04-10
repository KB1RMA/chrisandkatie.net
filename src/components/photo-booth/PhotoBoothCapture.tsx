'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';

type PhotoBoothCaptureProps = {
  onCapture: (blob: Blob) => void;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Human-readable camera error messages
const ERROR_MESSAGES: Record<string, string> = {
  'permission-denied':
    'Camera access was denied. Please allow camera access in your browser settings.',
  'no-camera': 'No camera was found on your device.',
  'not-supported': 'Camera access is not supported in this browser.',
  overconstrained: 'Could not start the camera with the required settings.',
  unknown: 'An unexpected error occurred while accessing the camera.',
};

/**
 * Camera viewfinder and capture component for the photo booth.
 *
 * Renders a live camera preview with a capture button. Falls back to a file
 * input when the camera API is unavailable or an error occurs. Performs a
 * client-side 10 MB size check before calling `onCapture`.
 *
 * @param onCapture - Callback invoked with the captured JPEG blob.
 * @returns The camera capture UI.
 */
export function PhotoBoothCapture({ onCapture }: PhotoBoothCaptureProps) {
  const { stream, error, isFallbackMode, startCamera } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Start camera automatically when not in fallback mode
  useEffect(() => {
    if (!isFallbackMode) {
      startCamera();
    }
  }, [isFallbackMode]);

  // Attach stream to video element when stream becomes available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  /**
   * Captures a JPEG frame from the video element via canvas.
   */
  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.drawImage(video, 0, 0);
    setIsCapturing(true);
    setSizeError(null);

    canvas.toBlob(
      (blob) => {
        setIsCapturing(false);

        if (!blob) {
          return;
        }

        if (blob.size > MAX_FILE_SIZE_BYTES) {
          setSizeError(
            'Captured photo is too large (max 10 MB). Please try again.',
          );

          return;
        }

        onCapture(blob);
      },
      'image/jpeg',
      0.9,
    );
  };

  /**
   * Handles file selection from the fallback file input.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setSizeError(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSizeError(
        'Selected photo is too large (max 10 MB). Please choose a smaller image.',
      );

      return;
    }

    onCapture(file);
  };

  const showFallback = isFallbackMode || !!error;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Camera viewfinder */}
      {!showFallback && (
        <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} playsInline autoPlay muted className="w-full" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Camera error message */}
      {error && (
        <p className="px-4 text-center text-sm text-[#9e3f3f]">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES['unknown']}
        </p>
      )}

      {/* Size validation error */}
      {sizeError && (
        <p className="px-4 text-center text-sm text-[#9e3f3f]" role="alert">
          {sizeError}
        </p>
      )}

      {/* Capture button (camera active) */}
      {!showFallback && stream && (
        <button
          type="button"
          onClick={handleCapture}
          disabled={isCapturing}
          className="min-h-[48px] min-w-[200px] rounded-full bg-[#9e3f3f] px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#7a2e2e] disabled:opacity-60"
        >
          {isCapturing ? 'Capturing…' : '📸 Take Photo'}
        </button>
      )}

      {/* Primary fallback: camera capture input */}
      {showFallback && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <p className="text-center text-sm text-[#6a5555]">
            Use your camera to take a photo:
          </p>
          <label className="flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full bg-[#9e3f3f] px-8 py-3 text-base font-semibold text-white shadow-md transition hover:bg-[#7a2e2e]">
            📸 Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          <p className="mt-2 text-center text-sm text-[#6a5555]">
            Or choose from your camera roll:
          </p>
          <label className="flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full border-2 border-[#9e3f3f] px-8 py-3 text-base font-semibold text-[#9e3f3f] transition hover:bg-[#fff0ee]">
            🖼️ Choose Photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
}
