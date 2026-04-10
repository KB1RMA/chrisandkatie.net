'use client';

import React from 'react';

type PolaroidCardProps = {
  src: string;
  alt: string;
  index?: number;
  children?: React.ReactNode;
};

// Deterministic tilt classes cycling by index position
const TILT_CLASSES = [
  '-rotate-[2deg]',
  'rotate-[1deg]',
  '-rotate-[1deg]',
  'rotate-[2deg]',
  'rotate-0',
];

/**
 * Polaroid-style card component with warm styling, sepia filter, and
 * deterministic per-index tilt.
 *
 * @param src - Image source URL.
 * @param alt - Accessible image alt text.
 * @param index - Optional index used to select a deterministic tilt angle.
 * @param children - Optional content rendered in the polaroid foot area.
 * @returns A styled polaroid card element.
 */
export function PolaroidCard({
  src,
  alt,
  index = 0,
  children,
}: PolaroidCardProps) {
  const tiltClass = TILT_CLASSES[index % TILT_CLASSES.length];

  return (
    <div
      className={`inline-flex flex-col bg-white p-3 pb-8 shadow-[4px_4px_16px_rgba(120,80,60,0.25)] transition-transform duration-200 hover:scale-105 ${tiltClass}`}
    >
      <div className="overflow-hidden">
        <img
          src={src}
          alt={alt}
          className="block w-full object-cover brightness-105 contrast-95 sepia-[0.3]"
        />
      </div>
      {children && (
        <div className="font-handwriting mt-2 text-center text-sm text-[#6a5555]">
          {children}
        </div>
      )}
    </div>
  );
}
