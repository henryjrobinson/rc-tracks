'use client';

import { useEffect, useRef, useState } from 'react';
import type { Track } from '@/lib/tracks';
import { geocode, getRoute, nearestOnPolylineMiles, type Route } from '@/lib/geo';

const CORRIDOR_OPTIONS = [5, 10, 25, 50, 100];

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
  onPlanned?: (result: TripResult | null) => void;
};

export function TripPlanner({ tracks, onPlanned }: Props) {
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [corridor, setCorridor] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TripResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onPlanned?.(result);
  }, [result, onPlanned]);

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

    try {
      const [from, to] = await Promise.all([
        geocode(startQ, ctrl.signal),
        geocode(destQ, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (!from) {
        setResult(null);
        setError(`Couldn't find a location matching "${startQ}".`);
        return;
      }
      if (!to) {
        setResult(null);
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
        setResult(null);
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

      setResult({
        route,
        startLabel: from.displayName,
        endLabel: to.displayName,
        corridorMi: corridor,
        matches,
      });
      if (matches.length === 0) {
        setError(`No tracks within ${corridor} mi of your route. Try a wider corridor.`);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setResult(null);
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
            onChange={(e) => setStart(e.target.value)}
            placeholder="City, ZIP, or address"
            aria-label="Trip start location"
            disabled={loading}
          />
        </label>
        <label className="trip-field">
          <span className="trip-label">Destination</span>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
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

      {error && <p className="trip-error">{error}</p>}

      {result && result.matches.length > 0 && (
        <p className="trip-summary">
          {result.matches.length} track{result.matches.length === 1 ? '' : 's'} within{' '}
          {result.corridorMi} mi of your {Math.round(result.route.distanceMi)} mi route.
        </p>
      )}

      {!result && !error && !loading && (
        <p className="trip-empty">
          Results will appear here after you plan a trip.
        </p>
      )}
    </section>
  );
}
