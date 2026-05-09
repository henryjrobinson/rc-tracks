'use client';

import { useRef, useState } from 'react';
import type { Track } from '@/lib/tracks';
import {
  geocode,
  getCurrentPosition,
  getRoute,
  nearestOnPolylineMiles,
  type LatLon,
  type Route,
} from '@/lib/geo';

const CORRIDOR_OPTIONS = [5, 10, 25, 50, 100];
const MY_LOCATION_LABEL = 'Your current location';

export type TripMatch = Track & { detourMi: number; alongMi: number };

export type TripResult = {
  route: Route;
  startLabel: string;
  endLabel: string;
  corridorMi: number;
  matches: TripMatch[];
};

type Props = {
  tracks: Track[];
  result: TripResult | null;
  onResultChange: (result: TripResult | null) => void;
  onShowOnMap?: () => void;
};

export function TripPlanner({ tracks, result, onResultChange, onShowOnMap }: Props) {
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [corridor, setCorridor] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startCoords, setStartCoords] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  function updateStart(value: string) {
    setStart(value);
    if (startCoords && value !== MY_LOCATION_LABEL) setStartCoords(null);
  }

  async function handleUseMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setStartCoords(pos);
      setStart(MY_LOCATION_LABEL);
    } catch (err) {
      setError((err as Error).message || 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }

  async function handlePlan() {
    const startQ = start.trim();
    const destQ = destination.trim();
    if (!startQ || !destQ) {
      setError('Enter both a start and destination.');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    const useCoords = startCoords && start === MY_LOCATION_LABEL ? startCoords : null;

    try {
      const [from, to] = await Promise.all([
        useCoords
          ? Promise.resolve({ ...useCoords, displayName: MY_LOCATION_LABEL })
          : geocode(startQ, ctrl.signal),
        geocode(destQ, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (!from) {
        onResultChange(null);
        setError(`Couldn't find a location matching "${startQ}".`);
        return;
      }
      if (!to) {
        onResultChange(null);
        setError(`Couldn't find a location matching "${destQ}".`);
        return;
      }

      const route = await getRoute(
        { lat: from.lat, lon: from.lon },
        { lat: to.lat, lon: to.lon },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (!route) {
        onResultChange(null);
        setError('No driving route found between those locations.');
        return;
      }

      const matches: TripMatch[] = [];
      for (const t of tracks) {
        if (t.lat == null || t.lon == null) continue;
        const m = nearestOnPolylineMiles({ lat: t.lat, lon: t.lon }, route.polyline);
        if (m.detourMi <= corridor) {
          matches.push({ ...t, detourMi: m.detourMi, alongMi: m.alongMi });
        }
      }
      matches.sort((a, b) => a.alongMi - b.alongMi);

      onResultChange({
        route,
        startLabel: from.displayName,
        endLabel: to.displayName,
        corridorMi: corridor,
        matches,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      onResultChange(null);
      setError((err as Error).message || 'Trip planning failed. Please try again.');
    } finally {
      if (abortRef.current === ctrl) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }

  return (
    <section className="trip-panel" aria-labelledby="trip-heading">
      <h2 id="trip-heading" className="trip-heading">
        Plan a road trip
      </h2>
      <p className="trip-sub">
        Enter a start and destination to find RC tracks within a corridor along your driving route.
      </p>

      <div className="trip-form">
        <label className="trip-field">
          <span className="trip-label">Start</span>
          <input
            type="text"
            value={start}
            onChange={(e) => updateStart(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handlePlan();
              }
            }}
            placeholder="City, ZIP, or address"
            aria-label="Trip start location"
            disabled={loading}
          />
          <button
            type="button"
            className="trip-use-location"
            onClick={handleUseMyLocation}
            disabled={loading || locating}
          >
            {locating ? 'Getting location…' : '📍 Use my location'}
          </button>
        </label>
        <label className="trip-field">
          <span className="trip-label">Destination</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handlePlan();
              }
            }}
            placeholder="City, ZIP, or address"
            aria-label="Trip destination"
            disabled={loading}
          />
        </label>
        <label className="trip-field">
          <span className="trip-label">Corridor</span>
          <select
            value={corridor}
            onChange={(e) => setCorridor(Number(e.target.value))}
            aria-label="Corridor radius (miles)"
            disabled={loading}
          >
            {CORRIDOR_OPTIONS.map((mi) => (
              <option key={mi} value={mi}>
                within {mi} mi
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary trip-submit"
          onClick={handlePlan}
          disabled={loading}
        >
          {loading ? 'Planning…' : 'Plan trip'}
        </button>
      </div>

      {error && (
        <p className="trip-error" role="alert">
          {error}
        </p>
      )}

      <span className="trip-live" aria-live="polite" aria-atomic="true">
        {loading
          ? 'Planning trip…'
          : result
            ? `${result.matches.length} track${result.matches.length === 1 ? '' : 's'} within ${result.corridorMi} miles of your route.`
            : ''}
      </span>

      {loading && (
        <div className="trip-results trip-skeleton" aria-hidden="true">
          <div className="trip-results-header">
            <span className="skeleton skeleton-stats" />
            <span className="skeleton skeleton-count" />
          </div>
          <div className="trip-results-list">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        </div>
      )}

      {!loading && result && (
        <div className="trip-results">
          <div className="trip-results-header">
            <span className="trip-results-stats">
              <strong>{Math.round(result.route.distanceMi)} mi</strong>
              <span className="trip-results-divider">·</span>
              <span>{formatDuration(result.route.durationMin)}</span>
            </span>
            <span className="trip-results-actions">
              <span className="trip-results-count">
                {result.matches.length} track{result.matches.length === 1 ? '' : 's'} within{' '}
                {result.corridorMi} mi
              </span>
              {onShowOnMap && result.matches.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary trip-show-on-map"
                  onClick={onShowOnMap}
                >
                  Show on map
                </button>
              )}
            </span>
          </div>

          {result.matches.length === 0 ? (
            <p className="trip-results-empty">
              No tracks within {result.corridorMi} mi of your route. Try a wider corridor.
            </p>
          ) : (
            <div className="list trip-results-list">
              {result.matches.map((m) => (
                <TripResultCard key={m.slug} match={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !error && !loading && (
        <p className="trip-empty">
          Results will appear here after you plan a trip.
        </p>
      )}
    </section>
  );
}

function TripResultCard({ match }: { match: TripMatch }) {
  const loc = [match.city, match.state, match.countryCode].filter(Boolean).join(', ');
  const showTags = (match.surface && match.surface !== 'unknown') || match.indoor;
  return (
    <article className="card">
      <div className="card-head">
        <a className="card-name" href={match.url} target="_blank" rel="noreferrer">
          {match.name}
        </a>
        <span className="card-loc">
          {loc}
          <span className="trip-detour"> · {match.detourMi.toFixed(1)} mi off route</span>
        </span>
      </div>

      {showTags && (
        <div className="tags">
          {match.surface && match.surface !== 'unknown' && (
            <span className={`tag tag-${match.surface}`}>{match.surface}</span>
          )}
          {match.indoor && <span className="tag">indoor</span>}
        </div>
      )}

      <div className="card-meta">
        {match.website && (
          <a href={match.website} target="_blank" rel="noreferrer">
            Website
          </a>
        )}
        {match.lat != null && match.lon != null && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${match.lat},${match.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Map
          </a>
        )}
      </div>
    </article>
  );
}

function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
