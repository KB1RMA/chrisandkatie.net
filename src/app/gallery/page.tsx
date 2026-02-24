import { Marcellus } from 'next/font/google';
import { PhotoGallery, type Photo } from '@/components/PhotoGallery';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

/**
 * Wedding celebration photos.
 */
const photos: Photo[] = [
  {
    src: '/images/gallery/DJI_0045.jpg',
    width: 5455,
    height: 3634,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_0252.jpg',
    width: 4000,
    height: 6000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_0293-2.jpg',
    width: 2595,
    height: 3523,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_5936.jpg',
    width: 6000,
    height: 4000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_5995.jpg',
    width: 6000,
    height: 4000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_6046.jpg',
    width: 2427,
    height: 3737,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_6049.jpg',
    width: 3091,
    height: 3933,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_6075.jpg',
    width: 5661,
    height: 3774,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_6289.jpg',
    width: 3819,
    height: 5679,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_8286.jpg',
    width: 2723,
    height: 4000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_8812.jpg',
    width: 3086,
    height: 3906,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_8923.jpg',
    width: 4000,
    height: 6000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_8940-2.jpg',
    width: 6000,
    height: 4000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/IMG_8992.jpg',
    width: 6000,
    height: 4000,
    alt: 'Chris and Katie celebration photo',
  },
  {
    src: '/images/gallery/image000000.jpeg',
    width: 1125,
    height: 1584,
    alt: 'Chris and Katie celebration photo',
  },
];

export default async function GalleryPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start">
      <div className="w-full bg-black p-4 sm:p-8">
        <div className="mx-auto w-full max-w-7xl">
          <PhotoGallery photos={photos} />
        </div>
      </div>
    </main>
  );
}
