'use client';

import { useMemo, useState } from 'react';
import type { Track } from '@/lib/tracks';

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
  RU: 'Russia', UA: 'Ukraine',
};

export function TrackBrowser({ tracks }: Props) {
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('');
  const [surface, setSurface] = useState('');
  const [indoor, setIndoor] = useState('');

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tracks) {
      const cc = t.countryCode ?? '';
      if (!cc) continue;
      counts.set(cc, (counts.get(cc) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tracks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tracks.filter((t) => {
      if (country && t.countryCode !== country) return false;
      if (surface && t.surface !== surface) return false;
      if (indoor === 'indoor' && !t.indoor) return false;
      if (indoor === 'outdoor' && t.indoor) return false;
      if (!needle) return true;
      const hay = [t.name, t.city, t.state, t.country, t.slug, t.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [tracks, q, country, surface, indoor]);

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

      <p className="summary">
        Showing {filtered.length.toLocaleString()} of {tracks.length.toLocaleString()} tracks
      </p>

      {filtered.length === 0 ? (
        <p className="empty">No tracks match your filters.</p>
      ) : (
        <div className="list">
          {filtered.map((t) => (
            <TrackCard key={t.slug} track={t} />
          ))}
        </div>
      )}
    </>
  );
}

function TrackCard({ track }: { track: Track }) {
  const loc = [track.city, track.state, track.countryCode].filter(Boolean).join(', ');
  return (
    <article className="card">
      <div className="card-head">
        <a className="card-name" href={track.url} target="_blank" rel="noreferrer">
          {track.name}
        </a>
        {loc && <span className="card-loc">{loc}</span>}
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
