'use client';

/**
 * Client wrapper that lazy-loads HotelRouteMap on the browser only.
 *
 * next/dynamic with ssr:false must live in a 'use client' module —
 * it cannot be called directly from a Server Component.
 */
import dynamic from 'next/dynamic';
import type { HotelRouteMapProps } from './HotelRouteMap';

const HotelRouteMap = dynamic(
  () =>
    import('@/components/HotelRouteMap').then((mod) => ({
      default: mod.HotelRouteMap,
    })),
  { ssr: false },
);

/**
 * Lazily-loaded hotel route map for use inside Server Components.
 *
 * @param props - Forwarded to HotelRouteMap.
 */
export function HotelRouteMapClient(props: HotelRouteMapProps) {
  return <HotelRouteMap {...props} />;
}
