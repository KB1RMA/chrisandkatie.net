'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  type RenderImageContext,
  type RenderImageProps,
} from 'react-photo-album';
import ServerPhotoAlbum from 'react-photo-album/server';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import 'react-photo-album/rows.css';

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
      <ServerPhotoAlbum
        unstyled
        layout="rows"
        photos={photos}
        render={{ image: renderNextImage }}
        breakpoints={[300, 600, 900]}
        classNames={{
          container: '@container',
          breakpoints: {
            150: 'block @[300px]:hidden',
            300: 'hidden @[300px]:block @[600px]:hidden',
            600: 'hidden @[600px]:block @[900px]:hidden',
            900: 'hidden @[900px]:block',
          },
        }}
        // @ts-expect-error - This apperas to work
        onClick={({ index: current }) => setIndex(current)}
      />

      <Lightbox
        slides={photos}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        render={{
          slide: ({ slide }) =>
            slide.src ? (
              <div className="relative flex h-full w-full items-center justify-center">
                <Image
                  src={slide.src}
                  alt={slide.alt || 'Gallery photo'}
                  width={slide.width}
                  height={slide.height}
                  className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
                  priority
                />
              </div>
            ) : null,
        }}
        styles={{
          container: { backgroundColor: 'rgba(0, 0, 0, 0.95)' },
        }}
      />
    </>
  );
}
