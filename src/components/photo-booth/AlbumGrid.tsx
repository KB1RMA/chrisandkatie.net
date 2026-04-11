'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePartySocket } from 'partysocket/react';
import { MasonryPhotoAlbum } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import { PolaroidCard } from '@/components/photo-booth/PolaroidCard';

type AlbumPhoto = {
  id: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  uploadedAt: string;
  takenBy: string | null;
};

type AlbumGridProps = {
  /** Initial photos fetched server-side to avoid layout shift on first render. */
  initialPhotos: AlbumPhoto[];
  /** Cursor for the next page, derived from the server-side fetch. */
  initialNextCursor?: string | null;
  /** Whether more pages exist beyond the initial server-side fetch. */
  initialHasMore?: boolean;
  /** Optional event ID to scope the album to a specific event. */
  eventId?: string;
};

const DEFAULT_WIDTH = 3;
const DEFAULT_HEIGHT = 4;
const PAGE_SIZE = 24;

/** Converts an AlbumPhoto to the shape react-photo-album requires. */
function toReactPhotoAlbumPhoto(photo: AlbumPhoto) {
  return {
    src: photo.publicUrl,
    width: photo.width ?? DEFAULT_WIDTH,
    height: photo.height ?? DEFAULT_HEIGHT,
    key: photo.id,
    alt: 'Guest photo',
    _albumPhoto: photo,
  };
}

/**
 * Real-time masonry grid of guest photos.
 *
 * Subscribes to the PartyKit room for live photo-added and photo-removed
 * events. Falls back to 5-second polling when the WebSocket is unavailable.
 * Loads additional pages via IntersectionObserver.
 *
 * When `eventId` is provided the grid is scoped to that event's album and
 * subscribes to the event-specific PartyKit room; otherwise it shows the
 * main wedding album.
 *
 * @param initialPhotos - First page of photos fetched on the server.
 * @param eventId - Optional event ID to scope the album to a specific event.
 * @returns The interactive album grid element.
 */
export function AlbumGrid({
  initialPhotos,
  initialNextCursor = null,
  initialHasMore = false,
  eventId,
}: AlbumGridProps) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>(initialPhotos);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Build a URL for the photos API, optionally scoped to an event
  const buildPhotosUrl = useCallback(
    (params: Record<string, string>) => {
      const searchParams = new URLSearchParams(params);

      if (eventId) {
        searchParams.set('eventId', eventId);
      }

      return `/api/photo-booth/photos?${searchParams.toString()}`;
    },
    [eventId],
  );

  // Fetch the latest first page and merge new photos at the front
  const pollForNewPhotos = useCallback(async () => {
    try {
      const response = await fetch(
        buildPhotosUrl({ limit: String(PAGE_SIZE) }),
      );

      if (!response.ok) {
        return;
      }

      const data: {
        photos: AlbumPhoto[];
        nextCursor: string | null;
        hasMore: boolean;
      } = await response.json();

      setPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPhotos = data.photos.filter((p) => !existingIds.has(p.id));

        return newPhotos.length > 0 ? [...newPhotos, ...prev] : prev;
      });
    } catch {
      // Silently ignore polling errors
    }
  }, [buildPhotosUrl]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return;
    }

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(pollForNewPhotos, 5000);
  }, [pollForNewPhotos]);

  const stopPolling = useCallback(() => {
    if (!pollingIntervalRef.current) {
      return;
    }

    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
    setIsPolling(false);
  }, []);

  const partyKitRoom = eventId ?? 'wedding-album';

  usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    room: partyKitRoom,
    onMessage(event) {
      try {
        const message = JSON.parse(event.data as string);

        if (message.type === 'photo-added') {
          const incoming = {
            ...(message.photo as Omit<AlbumPhoto, 'takenBy'>),
            takenBy: null,
          } satisfies AlbumPhoto;

          setPhotos((prev) => {
            const alreadyExists = prev.some((p) => p.id === incoming.id);

            return alreadyExists ? prev : [incoming, ...prev];
          });
        } else if (message.type === 'photo-removed') {
          const { photoId } = message as { photoId: string };

          setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        }
      } catch {
        // Ignore malformed messages
      }
    },
    onClose() {
      startPolling();
    },
    onError() {
      startPolling();
    },
    onOpen() {
      stopPolling();
    },
  });

  // Load the next page of photos when the sentinel scrolls into view
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const url = buildPhotosUrl({
        cursor: nextCursor,
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(url);

      if (!response.ok) {
        return;
      }

      const data: {
        photos: AlbumPhoto[];
        nextCursor: string | null;
        hasMore: boolean;
      } = await response.json();

      setPhotos((prev) => [...prev, ...data.photos]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Silently ignore load-more errors
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor]);

  // Set up IntersectionObserver on the sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-stone-500">
          No photos yet — be the first to take one!
        </p>
      </div>
    );
  }

  const albumPhotos = photos.map(toReactPhotoAlbumPhoto);

  return (
    <div>
      {isPolling && (
        <p className="mb-4 text-center text-sm text-amber-600">
          Live updates paused — checking for new photos every 5 seconds
        </p>
      )}
      <MasonryPhotoAlbum
        photos={albumPhotos}
        columns={(containerWidth) => {
          if (containerWidth < 640) return 2;
          if (containerWidth < 1024) return 3;

          return 4;
        }}
        render={{
          photo: (_props, { photo, index }) => (
            <PolaroidCard
              key={photo.key}
              src={photo.src}
              alt="Guest photo"
              index={index}
            >
              {photo._albumPhoto.takenBy}
            </PolaroidCard>
          ),
        }}
      />
      <div ref={sentinelRef} className="h-8" aria-hidden="true" />
      {isLoadingMore && (
        <p className="mt-4 text-center text-sm text-stone-500">
          Loading more photos…
        </p>
      )}
    </div>
  );
}
