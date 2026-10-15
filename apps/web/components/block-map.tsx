'use client';

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
/** Served from public/ (copied by scripts/copy-maplibre-worker.mjs). */
export const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';
export const SINGAPORE = { center: [103.82, 1.355] as [number, number], zoom: 10.6 };

export type MapDot = { id: number; lat: number; lng: number; percent: number; passes: boolean; label: string };

/** Repaints OpenFreeMap's Positron style in the suphomey pastels. */
export function pastelise(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification;
  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#fbf7f0');
    else if (layer.type === 'fill' && id.includes('water')) map.setPaintProperty(layer.id, 'fill-color', '#c9ddf7');
    else if (layer.type === 'fill' && /park|wood|grass|forest|cemetery/.test(id)) map.setPaintProperty(layer.id, 'fill-color', '#d7efe4');
  }
}

type Props = {
  dots: MapDot[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

/**
 * Every HDB block as a dot. Matching blocks are coloured by match %, blocks
 * that fail a must-have fade to small grey dots so the shape of the city stays
 * visible. Data updates go through setData, so toggling a chip doesn't rebuild
 * the map.
 */
export default function BlockMap({ dots, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  const latest = useRef({ dots, selectedId });
  // Keep the latest props reachable from MapLibre callbacks, which are registered once.
  useEffect(() => {
    onSelectRef.current = onSelect;
    latest.current = { dots, selectedId };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      maplibregl.setWorkerUrl(WORKER_URL);
      const m = new maplibregl.Map({
        container: container.current,
        style: BASEMAP_STYLE,
        center: SINGAPORE.center,
        zoom: SINGAPORE.zoom,
        minZoom: 9.5,
        maxBounds: [
          [103.4, 1.1],
          [104.2, 1.6],
        ],
        attributionControl: { compact: true },
      });
      map = m;
      mapRef.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        pastelise(m);
        m.addSource('blocks', { type: 'geojson', data: toGeoJson(latest.current.dots) });
        m.addLayer({
          id: 'blocks-out',
          type: 'circle',
          source: 'blocks',
          filter: ['==', ['get', 'passes'], false],
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3], 'circle-color': '#9aa0ab', 'circle-opacity': 0.35 },
        });
        m.addLayer({
          id: 'blocks-in',
          type: 'circle',
          source: 'blocks',
          filter: ['==', ['get', 'passes'], true],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 13, 4, 16, 8],
            'circle-color': ['interpolate', ['linear'], ['get', 'percent'], 0, '#ffe9a8', 50, '#ffb48f', 75, '#ff7a59', 100, '#c2361b'],
            'circle-stroke-color': '#1f2430',
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0, 14, 1],
          },
        });
        m.addLayer({
          id: 'blocks-selected',
          type: 'circle',
          source: 'blocks',
          filter: ['==', ['get', 'id'], latest.current.selectedId ?? -1],
          paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#1f2430', 'circle-stroke-width': 3 },
        });
        for (const layer of ['blocks-in', 'blocks-out']) {
          m.on('click', layer, (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === 'number') onSelectRef.current(id);
          });
          m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        }
        ready.current = true;
      });
    });
    return () => {
      cancelled = true;
      ready.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource('blocks') as GeoJSONSource | undefined)?.setData(toGeoJson(dots));
  }, [dots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    map.setFilter('blocks-selected', ['==', ['get', 'id'], selectedId ?? -1]);
    const dot = dots.find((d) => d.id === selectedId);
    if (dot && !map.getBounds().contains([dot.lng, dot.lat])) map.easeTo({ center: [dot.lng, dot.lat], zoom: Math.max(map.getZoom(), 14) });
    // Only react to selection changes; dots changing should not move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={container} className="h-full w-full" role="region" aria-label="Map of HDB blocks coloured by match" />;
}

function toGeoJson(dots: MapDot[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: dots.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
      properties: { id: d.id, percent: d.percent, passes: d.passes, label: d.label },
    })),
  };
}
