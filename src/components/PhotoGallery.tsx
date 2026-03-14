'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  MasonryPhotoAlbum,
  type RenderImageContext,
  type RenderImageProps,
} from 'react-photo-album';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

import 'yet-another-react-lightbox/styles.css';
import 'react-photo-album/masonry.css';

/**
 * Photo type for the gallery.
 */
export type Photo = {
  src: string;
  width: number;
  height: number;
  alt?: string;
};

export type PhotoGalleryProps = {
  photos: Photo[];
};

function renderNextImage(
  { alt = '', title, sizes }: RenderImageProps,
  { photo, width, height }: RenderImageContext,
) {
  return (
    <div
      style={{
        width: '100%',
        position: 'relative',
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <Image
        fill
        src={photo}
        alt={alt}
        title={title}
        sizes={sizes}
        placeholder={'blurDataURL' in photo ? 'blur' : undefined}
      />
    </div>
  );
}

/**
 * Photo gallery component with lightbox viewer.
 * Uses react-photo-album for responsive masonry layout
 * and yet-another-react-lightbox for fullscreen viewing.
 * Integrates Next.js Image component in the lightbox for optimized loading.
 *
 * @param props - Component props including photos array.
 * @returns Photo gallery with interactive lightbox.
 */
export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [index, setIndex] = useState(-1);

  return (
    <>
      <MasonryPhotoAlbum
        photos={photos}
        render={{ image: renderNextImage }}
        onClick={({ index: current }) => setIndex(current)}
        spacing={3}
        columns={(containerWidth) => {
          if (containerWidth < 330) return 1;
          if (containerWidth < 460) return 2;
          if (containerWidth < 800) return 3;

          return 4;
        }}
      />

      <Lightbox
        slides={photos}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        plugins={[Zoom]}
        render={{
          slide: ({ slide }) =>
            slide.src ? (
              <div className="relative flex h-full w-full items-center justify-center">
                <Image
                  src={slide.src}
                  alt={slide.alt || 'Gallery photo'}
                  width={slide.width}
                  height={slide.height}
                  className="h-auto max-h-screen w-auto max-w-full object-contain"
                  priority
                />
              </div>
            ) : null,
        }}
        styles={{
          root: { padding: 0 },
          container: { backgroundColor: '#000', padding: 0 },
          slide: { padding: 0 },
          button: { filter: 'none' },
        }}
        className="yarl-no-border"
      />
    </>
  );
}
