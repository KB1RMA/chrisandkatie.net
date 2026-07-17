vi.mock('partysocket/react', () => ({
  usePartySocket: vi.fn(),
}));

// MasonryPhotoAlbum depends on ResizeObserver, which jsdom lacks. The mock
// renders one element per photo so ordering and membership can be asserted.
vi.mock('react-photo-album', () => ({
  MasonryPhotoAlbum: ({
    photos,
  }: {
    photos: Array<{ key?: string; src: string }>;
  }) => (
    <ul>
      {photos.map((photo) => (
        <li key={photo.key} data-testid="photo" data-src={photo.src} />
      ))}
    </ul>
  ),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { usePartySocket } from 'partysocket/react';
import { AlbumGrid } from '@/components/photo-booth/AlbumGrid';

const mockUsePartySocket = vi.mocked(usePartySocket);

// jsdom does not implement IntersectionObserver, which AlbumGrid uses for
// infinite scrolling.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

type SocketOptions = Parameters<typeof usePartySocket>[0] & {
  onMessage?: (event: MessageEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
};

/** Returns the options passed to the most recent usePartySocket call. */
function lastSocketOptions(): SocketOptions {
  const lastCall = mockUsePartySocket.mock.calls.at(-1);

  if (!lastCall) {
    throw new Error('usePartySocket was never called');
  }

  return lastCall[0] as SocketOptions;
}

/** Delivers a raw WebSocket message payload to the component. */
function deliverMessage(data: string) {
  act(() => {
    lastSocketOptions().onMessage?.({ data } as MessageEvent);
  });
}

/** Reads the rendered photo srcs in display order. */
function renderedSrcs(): Array<string | null> {
  return screen
    .getAllByTestId('photo')
    .map((element) => element.getAttribute('data-src'));
}

const initialPhotos = [
  {
    id: 'photo-1',
    publicUrl: 'https://photos.example.com/1.jpg',
    width: 1920,
    height: 1080,
    uploadedAt: '2026-07-01T12:00:00.000Z',
    takenBy: null,
  },
  {
    id: 'photo-2',
    publicUrl: 'https://photos.example.com/2.jpg',
    width: 1080,
    height: 1920,
    uploadedAt: '2026-07-01T11:00:00.000Z',
    takenBy: 'Alice',
  },
];

const addedMessage = JSON.stringify({
  type: 'photo-added',
  photo: {
    id: 'photo-3',
    publicUrl: 'https://photos.example.com/3.jpg',
    width: 800,
    height: 600,
    uploadedAt: '2026-07-01T13:00:00.000Z',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AlbumGrid', () => {
  test('should render the initial photos', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    expect(renderedSrcs()).toEqual([
      'https://photos.example.com/1.jpg',
      'https://photos.example.com/2.jpg',
    ]);
  });

  test('should subscribe to the wedding-album room on the page origin', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    const options = lastSocketOptions();

    // No host override — partysocket defaults to window.location.host, the
    // same worker origin that serves the WebSocket route.
    expect(options.host).toBeUndefined();
    expect(options.party).toBe('photo-album');
    expect(options.room).toBe('wedding-album');
  });

  test('should subscribe to the event room when eventId is provided', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} eventId="event-123" />);

    expect(lastSocketOptions().room).toBe('event-123');
  });

  test('should prepend a photo from a photo-added message', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    deliverMessage(addedMessage);

    expect(renderedSrcs()).toEqual([
      'https://photos.example.com/3.jpg',
      'https://photos.example.com/1.jpg',
      'https://photos.example.com/2.jpg',
    ]);
  });

  test('should ignore a photo-added message for an existing photo', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    deliverMessage(
      JSON.stringify({
        type: 'photo-added',
        photo: {
          id: 'photo-1',
          publicUrl: 'https://photos.example.com/duplicate.jpg',
          uploadedAt: '2026-07-01T14:00:00.000Z',
        },
      }),
    );

    expect(renderedSrcs()).toEqual([
      'https://photos.example.com/1.jpg',
      'https://photos.example.com/2.jpg',
    ]);
  });

  test('should remove a photo from a photo-removed message', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    deliverMessage(
      JSON.stringify({ type: 'photo-removed', photoId: 'photo-1' }),
    );

    expect(renderedSrcs()).toEqual(['https://photos.example.com/2.jpg']);
  });

  test('should ignore messages that are not valid JSON', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    deliverMessage('not-json');

    expect(renderedSrcs()).toHaveLength(2);
  });

  test('should ignore messages that do not match the shared contract', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    deliverMessage(
      JSON.stringify({ type: 'photo-updated', photoId: 'photo-1' }),
    );

    expect(renderedSrcs()).toHaveLength(2);
  });

  test('should fall back to polling when the socket closes and stop when it reopens', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    const pollingNotice = /Live updates paused/;

    expect(screen.queryByText(pollingNotice)).not.toBeInTheDocument();

    act(() => {
      lastSocketOptions().onClose?.();
    });

    expect(screen.getByText(pollingNotice)).toBeInTheDocument();

    act(() => {
      lastSocketOptions().onOpen?.();
    });

    expect(screen.queryByText(pollingNotice)).not.toBeInTheDocument();
  });

  test('should start polling when the socket errors', () => {
    render(<AlbumGrid initialPhotos={initialPhotos} />);

    act(() => {
      lastSocketOptions().onError?.();
    });

    expect(screen.getByText(/Live updates paused/)).toBeInTheDocument();
  });

  test('should render the empty state when there are no photos', () => {
    render(<AlbumGrid initialPhotos={[]} />);

    expect(
      screen.getByText(/No photos yet — be the first to take one!/),
    ).toBeInTheDocument();
  });
});
