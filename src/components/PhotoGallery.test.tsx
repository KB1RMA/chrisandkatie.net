import { expect, test, describe, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoGallery } from './PhotoGallery';

// jsdom does not implement ResizeObserver, which react-photo-album's masonry
// layout uses to measure its container. Stubbing it (not the library) lets
// the real react-photo-album and yet-another-react-lightbox code run.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// jsdom has no layout engine, so every element measures 0x0. react-photo-album
// bails out of laying out any photos when the measured container width is 0,
// so give elements a nonzero width — same idea as the ResizeObserver stub
// above, filling in a browser capability jsdom doesn't provide.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  value: 800,
});

const photos = [
  {
    src: 'https://photos.example.com/1.jpg',
    width: 1920,
    height: 1080,
    alt: 'First photo',
  },
  {
    src: 'https://photos.example.com/2.jpg',
    width: 1080,
    height: 1920,
    alt: 'Second photo',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PhotoGallery', () => {
  test('should render every photo in the masonry album', () => {
    render(<PhotoGallery photos={photos} />);

    expect(screen.getAllByRole('img')).toHaveLength(photos.length);
  });

  test('should not show the lightbox before a photo is clicked', () => {
    render(<PhotoGallery photos={photos} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('should open the lightbox on the clicked photo when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} />);

    await user.click(screen.getByAltText('Second photo'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // The lightbox renders the full-size image via next/image, separate from
    // the masonry thumbnail for the same photo.
    expect(screen.getAllByAltText('Second photo')).toHaveLength(2);
  });

  test('should close the lightbox when dismissed', async () => {
    const user = userEvent.setup();
    render(<PhotoGallery photos={photos} />);

    await user.click(screen.getAllByRole('img')[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/close/i));

    // The lightbox fades out before unmounting, so wait for it to be removed.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  test('should render nothing when there are no photos', () => {
    render(<PhotoGallery photos={[]} />);

    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});
