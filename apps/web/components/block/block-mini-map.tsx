'use client';

import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { BlockProfile } from '@/lib/server/block-profile';
import { BASEMAP_STYLE, pastelise, WORKER_URL } from '../block-map';

const PINS: { kind: keyof BlockProfile['nearby']; emoji: string; max: number }[] = [
  { kind: 'mrt_exit', emoji: '🚇', max: 2 },
  { kind: 'hawker', emoji: '🍜', max: 3 },
  { kind: 'primary_school', emoji: '🎒', max: 3 },
  { kind: 'park', emoji: '🌳', max: 2 },
  { kind: 'clinic', emoji: '🩺', max: 2 },
];

/** The block and its nearest key places, as emoji pins. */
export default function BlockMiniMap({ profile }: { profile: BlockProfile }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (profile.lat === null || profile.lng === null) return;
    const centre: [number, number] = [profile.lng, profile.lat];
    let map: MapLibreMap | undefined;
    let cancelled = false;
    import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(WORKER_URL);
      const m = new maplibregl.Map({ container: container.current, style: BASEMAP_STYLE, center: centre, zoom: 14.6, attributionControl: { compact: true }, cooperativeGestures: true });
      map = m;
      m.on('load', () => pastelise(m));
      const pin = (emoji: string, at: [number, number], title: string, big = false) => {
        const el = document.createElement('div');
        el.textContent = emoji;
        el.title = title;
        el.style.cssText = `font-size:${big ? 30 : 20}px;line-height:1;filter:drop-shadow(1px 1px 0 #1f2430)`;
        new maplibregl.Marker({ element: el }).setLngLat(at).addTo(m);
      };
      const bounds = new maplibregl.LngLatBounds(centre, centre);
      for (const { kind, emoji, max } of PINS) {
        for (const p of (profile.nearby[kind] ?? []).slice(0, max)) {
          pin(emoji, [p.lng, p.lat], `${p.name} (${p.distanceM} m)`);
          if (p.distanceM <= 1200) bounds.extend([p.lng, p.lat]);
        }
      }
      pin('🏠', centre, profile.label, true);
      m.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [profile]);

  if (profile.lat === null) return null;
  return <div ref={container} className="h-72 w-full overflow-hidden rounded-2xl border-2 border-ink" role="region" aria-label={`Map of ${profile.label} and nearby places`} />;
}
