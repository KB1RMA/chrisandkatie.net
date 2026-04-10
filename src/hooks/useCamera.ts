'use client';

import { useState, useEffect, useRef } from 'react';

// Error types that can result from camera access attempts
type CameraError =
  | 'permission-denied'
  | 'no-camera'
  | 'not-supported'
  | 'overconstrained'
  | 'unknown';

type UseCameraReturn = {
  stream: MediaStream | null;
  error: CameraError | null;
  isFallbackMode: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
};

// Preferred camera constraints — rear camera, HD resolution
const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

// Relaxed fallback used when preferred constraints are overconstrained
const FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  video: true,
};

/**
 * Maps a DOMException name to a typed CameraError value.
 *
 * @param name - The DOMException name string.
 * @returns The corresponding CameraError value.
 */
function mapErrorName(name: string): CameraError {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'permission-denied';

    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'no-camera';

    case 'NotSupportedError':
      return 'not-supported';

    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'overconstrained';

    default:
      return 'unknown';
  }
}

/**
 * React hook for accessing the device camera via `getUserMedia`.
 *
 * Handles error categorisation, overconstrained retry with relaxed constraints,
 * and detects when the camera API is unavailable (fallback mode).
 *
 * @returns Camera stream, error state, fallback flag, and control functions.
 */
export function useCamera(): UseCameraReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect fallback mode at mount — mediaDevices may be undefined in HTTP or older browsers
  const isFallbackMode =
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.getUserMedia;

  /**
   * Stops all tracks on the current stream and clears state.
   */
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  /**
   * Requests camera access, retrying with relaxed constraints on OverconstrainedError.
   */
  const startCamera = async (): Promise<void> => {
    if (isFallbackMode) {
      return;
    }

    setError(null);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(
        PREFERRED_CONSTRAINTS,
      );

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'OverconstrainedError') {
        // Retry with minimal constraints before giving up
        try {
          const fallbackStream =
            await navigator.mediaDevices.getUserMedia(FALLBACK_CONSTRAINTS);

          streamRef.current = fallbackStream;
          setStream(fallbackStream);
        } catch (fallbackErr) {
          const mappedError =
            fallbackErr instanceof DOMException
              ? mapErrorName(fallbackErr.name)
              : 'overconstrained';

          setError(mappedError);
        }

        return;
      }

      const mappedError =
        err instanceof DOMException ? mapErrorName(err.name) : 'unknown';

      setError(mappedError);
    }
  };

  // Stop stream tracks on unmount to release the camera
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    stream,
    error,
    isFallbackMode,
    startCamera,
    stopCamera,
  };
}
