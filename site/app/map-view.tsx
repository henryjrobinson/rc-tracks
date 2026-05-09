'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Track } from '@/lib/tracks';
import type { LatLon } from '@/lib/geo';

const ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const HIGHLIGHT_ICON = L.divIcon({
  html: '<span class="trip-marker-pin"></span>',
  className: 'trip-marker',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

type Props = {
  tracks: Track[];
  origin?: LatLon | null;
  radiusMiles?: number;
  route?: LatLon[] | null;
  highlightedSlugs?: Set<string> | null;
};

const USA_CENTER: [number, number] = [39.5, -98.5];

export function MapView({ tracks, origin, radiusMiles, route, highlightedSlugs }: Props) {
  const geocoded = tracks.filter((t) => t.lat != null && t.lon != null);
  const radiusMeters = radiusMiles ? radiusMiles * 1609.344 : undefined;
  const routePositions: [number, number][] | null =
    route && route.length > 0 ? route.map((p) => [p.lat, p.lon]) : null;
  const highlightedCount = highlightedSlugs
    ? geocoded.reduce((n, t) => (highlightedSlugs.has(t.slug) ? n + 1 : n), 0)
    : 0;

  return (
    <div className="map-wrap">
      <MapContainer
        center={USA_CENTER}
        zoom={4}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MarkerCluster tracks={geocoded} highlightedSlugs={highlightedSlugs ?? null} />
        {origin && radiusMeters && (
          <Circle center={[origin.lat, origin.lon]} radius={radiusMeters} pathOptions={{ color: '#ff6a00', weight: 1.5, fillOpacity: 0.08 }} />
        )}
        {routePositions ? (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#ff6a00', weight: 4, opacity: 0.85 }}
            />
            <FitToRoute positions={routePositions} />
          </>
        ) : (
          origin && <FocusOnOrigin origin={origin} radiusMiles={radiusMiles ?? 0} />
        )}
      </MapContainer>
      <div className="map-summary">
        Showing {geocoded.length.toLocaleString()} tracks with coordinates ({tracks.length - geocoded.length} have no lat/lng yet)
        {highlightedCount > 0 && (
          <> · <span className="map-summary-highlight">{highlightedCount} on trip route</span></>
        )}
      </div>
    </div>
  );
}

function MarkerCluster({
  tracks,
  highlightedSlugs,
}: {
  tracks: Track[];
  highlightedSlugs: Set<string> | null;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
    });

    for (const t of tracks) {
      if (t.lat == null || t.lon == null) continue;
      const isHighlighted = highlightedSlugs?.has(t.slug) ?? false;
      const marker = L.marker([t.lat, t.lon], {
        icon: isHighlighted ? HIGHLIGHT_ICON : ICON,
        title: t.name,
        zIndexOffset: isHighlighted ? 1000 : 0,
      });
      marker.bindPopup(buildPopupHtml(t));
      group.addLayer(marker);
    }

    map.addLayer(group);
    groupRef.current = group;

    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map, tracks, highlightedSlugs]);

  return null;
}

function FocusOnOrigin({ origin, radiusMiles }: { origin: LatLon; radiusMiles: number }) {
  const map = useMap();
  useEffect(() => {
    const zoom = radiusMiles <= 25 ? 9 : radiusMiles <= 100 ? 7 : radiusMiles <= 250 ? 6 : 5;
    map.flyTo([origin.lat, origin.lon], zoom, { duration: 0.6 });
  }, [map, origin, radiusMiles]);
  return null;
}

function FitToRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

function buildPopupHtml(t: Track): string {
  const loc = [t.city, t.state, t.countryCode].filter(Boolean).join(', ');
  const lines: string[] = [
    `<strong><a href="${escapeAttr(t.url)}" target="_blank" rel="noreferrer">${escapeHtml(t.name)}</a></strong>`,
  ];
  if (loc) lines.push(escapeHtml(loc));
  if (t.surface && t.surface !== 'unknown') lines.push(`<em>${t.surface}${t.indoor ? ' · indoor' : ''}</em>`);
  if (t.website) lines.push(`<a href="${escapeAttr(t.website)}" target="_blank" rel="noreferrer">Website</a>`);
  return lines.join('<br>');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
