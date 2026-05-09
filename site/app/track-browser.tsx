'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Track } from '@/lib/tracks';
import { geocode, getCurrentPosition, haversineMiles, type LatLon } from '@/lib/geo';

import { TripPlanner, type TripResult } from './trip-planner';

const MapView = dynamic(() => import('./map-view').then((m) => m.MapView), { ssr: false });

type Props = { tracks: Track[] };

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  NZ: 'New Zealand', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', MX: 'Mexico', JP: 'Japan', CN: 'China', KR: 'South Korea',
  BR: 'Brazil', AR: 'Argentina', CH: 'Switzerland', AT: 'Austria', IE: 'Ireland',
  PT: 'Portugal', CZ: 'Czech Republic', PL: 'Poland', HU: 'Hungary', RO: 'Romania',
  TH: 'Thailand', SG: 'Singapore', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines',
  VN: 'Vietnam', IN: 'India', ZA: 'South Africa', IL: 'Israel', TR: 'Turkey',
  RU: 'Russia', UA: 'Ukraine', CO: 'Colombia', HK: 'Hong Kong', PR: 'Puerto Rico',
};

const RADIUS_OPTIONS = [10, 25, 50, 100, 250, 500];

type View = 'list' | 'map' | 'trip';

type WithDistance = Track & { distanceMi?: number };

export function TrackBrowser({ tracks }: Props) {
  const [view, setView] = useState<View>('list');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [usState, setUsState] = useState('');
  const [surface, setSurface] = useState('');
  const [indoor, setIndoor] = useState('');
  const [hasWebsite, setHasWebsite] = useState(false);

  const [locQuery, setLocQuery] = useState('');
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [originLabel, setOriginLabel] = useState('');
  const [radius, setRadius] = useState(100);
  const [locStatus, setLocStatus] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const [tripResult, setTripResult] = useState<TripResult | null>(null);

  const tripHighlightedSlugs = useMemo(
    () => (tripResult ? new Set(tripResult.matches.map((m) => m.slug)) : null),
    [tripResult],
  );
  const tripPolyline = tripResult?.route.polyline ?? null;

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tracks) {
      if (!t.countryCode) continue;
      counts.set(t.countryCode, (counts.get(t.countryCode) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tracks]);

  const usStates = useMemo(() => {
    if (country !== 'US') return [];
    const counts = new Map<string, number>();
    for (const t of tracks) {
      if (t.countryCode !== 'US' || !t.state) continue;
      counts.set(t.state, (counts.get(t.state) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks, country]);

  useEffect(() => {
    if (country !== 'US' && usState) setUsState('');
  }, [country, usState]);

  const filtered = useMemo<WithDistance[]>(() => {
    const needle = q.trim().toLowerCase();
    const list: WithDistance[] = [];
    for (const t of tracks) {
      if (country && t.countryCode !== country) continue;
      if (usState && t.state !== usState) continue;
      if (surface && t.surface !== surface) continue;
      if (indoor === 'indoor' && !t.indoor) continue;
      if (indoor === 'outdoor' && t.indoor) continue;
      if (hasWebsite && !t.website) continue;
      if (needle) {
        const hay = [t.name, t.city, t.state, t.country, t.slug, t.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      let distanceMi: number | undefined;
      if (origin && t.lat != null && t.lon != null) {
        distanceMi = haversineMiles(origin, { lat: t.lat, lon: t.lon });
        if (distanceMi > radius) continue;
      } else if (origin) {
        continue;
      }
      list.push(distanceMi != null ? { ...t, distanceMi } : t);
    }
    if (origin) list.sort((a, b) => (a.distanceMi ?? Infinity) - (b.distanceMi ?? Infinity));
    return list;
  }, [tracks, q, country, usState, surface, indoor, hasWebsite, origin, radius]);

  async function handleLookup() {
    const text = locQuery.trim();
    if (!text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLocStatus('Looking up…');
    try {
      const result = await geocode(text, ctrl.signal);
      if (!result) {
        setLocStatus('No location found.');
        setOrigin(null);
        return;
      }
      setOrigin({ lat: result.lat, lon: result.lon });
      setOriginLabel(result.displayName);
      setLocStatus('');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setLocStatus(`Lookup failed: ${(err as Error).message}`);
    }
  }

  async function handleNearMe() {
    setLocStatus('Requesting location…');
    try {
      const pos = await getCurrentPosition();
      setOrigin(pos);
      setOriginLabel('Your current location');
      setLocQuery('');
      setLocStatus('');
    } catch (err) {
      setLocStatus((err as Error).message);
    }
  }

  function clearLocation() {
    setOrigin(null);
    setOriginLabel('');
    setLocQuery('');
    setLocStatus('');
  }

  return (
    <>
      <div className="controls">
        <input
          type="search"
          placeholder="Search by name, city, state…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search tracks"
        />
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country">
          <option value="">All countries</option>
          {countries.map(([cc, n]) => (
            <option key={cc} value={cc}>
              {COUNTRY_NAMES[cc] ?? cc} ({n})
            </option>
          ))}
        </select>
        {country === 'US' && (
          <select value={usState} onChange={(e) => setUsState(e.target.value)} aria-label="Filter by US state">
            <option value="">All US states</option>
            {usStates.map(([code, n]) => (
              <option key={code} value={code}>
                {code} ({n})
              </option>
            ))}
          </select>
        )}
        <select value={surface} onChange={(e) => setSurface(e.target.value)} aria-label="Filter by surface">
          <option value="">Any surface</option>
          <option value="dirt">Dirt</option>
          <option value="carpet">Carpet</option>
          <option value="asphalt">Asphalt</option>
          <option value="turf">Turf</option>
        </select>
        <select value={indoor} onChange={(e) => setIndoor(e.target.value)} aria-label="Indoor or outdoor">
          <option value="">Indoor &amp; outdoor</option>
          <option value="indoor">Indoor only</option>
          <option value="outdoor">Outdoor only</option>
        </select>
      </div>

      <div className="distance-row">
        <input
          type="text"
          placeholder="City, ZIP, or address (e.g. San Jose, 95113, Boulder CO)"
          value={locQuery}
          onChange={(e) => setLocQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleLookup();
            }
          }}
          aria-label="Distance lookup location"
        />
        <button type="button" onClick={handleLookup} className="btn-primary">
          Find
        </button>
        <button type="button" onClick={handleNearMe} className="btn-secondary" title="Use my current location">
          📍 Near me
        </button>
        <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius (miles)">
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              within {r} mi
            </option>
          ))}
        </select>
        {origin && (
          <button type="button" onClick={clearLocation} className="btn-link">
            Clear location
          </button>
        )}
      </div>

      <div className="status-row">
        {origin && originLabel && (
          <span className="origin-pill">
            Within {radius} mi of <strong>{shortenLabel(originLabel)}</strong>
          </span>
        )}
        {locStatus && <span className="loc-status">{locStatus}</span>}
        <span className="grow" />
        <div className="view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={view === 'list' ? 'active' : ''}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            onClick={() => setView('map')}
            className={view === 'map' ? 'active' : ''}
          >
            Map
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'trip'}
            onClick={() => setView('trip')}
            className={view === 'trip' ? 'active' : ''}
          >
            Trip
          </button>
        </div>
      </div>

      <div className="quality-row">
        <label className="check">
          <input type="checkbox" checked={hasWebsite} onChange={(e) => setHasWebsite(e.target.checked)} />
          Has website
        </label>
        <span className="summary">
          Showing {filtered.length.toLocaleString()} of {tracks.length.toLocaleString()} tracks
        </span>
      </div>

      {view === 'list' && (
        filtered.length === 0 ? (
          <p className="empty">No tracks match your filters.</p>
        ) : (
          <div className="list">
            {filtered.map((t) => (
              <TrackCard key={t.slug} track={t} />
            ))}
          </div>
        )
      )}
      {view === 'map' && (
        <MapView
          tracks={filtered}
          origin={origin}
          radiusMiles={origin ? radius : undefined}
          route={tripPolyline}
          highlightedSlugs={tripHighlightedSlugs}
        />
      )}
      {view === 'trip' && <TripPlanner tracks={tracks} onPlanned={setTripResult} />}
    </>
  );
}

function TrackCard({ track }: { track: WithDistance }) {
  const loc = [track.city, track.state, track.countryCode].filter(Boolean).join(', ');
  return (
    <article className="card">
      <div className="card-head">
        <a className="card-name" href={track.url} target="_blank" rel="noreferrer">
          {track.name}
        </a>
        <span className="card-loc">
          {loc}
          {track.distanceMi != null && (
            <span className="distance"> · {Math.round(track.distanceMi)} mi</span>
          )}
        </span>
      </div>

      {(track.surface && track.surface !== 'unknown') || track.indoor ? (
        <div className="tags">
          {track.surface && track.surface !== 'unknown' && (
            <span className={`tag tag-${track.surface}`}>{track.surface}</span>
          )}
          {track.indoor && <span className="tag">indoor</span>}
        </div>
      ) : null}

      <div className="card-meta">
        {track.website && (
          <a href={track.website} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
        {track.lat != null && track.lon != null && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${track.lat},${track.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
        )}
        {track.phone && <a href={`tel:${track.phone}`}>{track.phone}</a>}
        {track.email && <a href={`mailto:${track.email}`}>{track.email}</a>}
      </div>
    </article>
  );
}

function shortenLabel(s: string): string {
  if (s.length <= 50) return s;
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length <= 3) return s;
  return [parts[0], parts[1], parts[parts.length - 1]].join(', ');
}
