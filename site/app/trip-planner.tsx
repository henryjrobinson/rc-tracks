'use client';

import { useState } from 'react';

const CORRIDOR_OPTIONS = [5, 10, 25, 50, 100];

export function TripPlanner() {
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const [corridor, setCorridor] = useState(25);

  function handlePlan() {
    // Stub for TRIP-1; real planning lands in TRIP-4.
    // eslint-disable-next-line no-console
    console.log('Plan trip', { start, destination, corridor });
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
          />
        </label>
        <label className="trip-field">
          <span className="trip-label">Corridor</span>
          <select
            value={corridor}
            onChange={(e) => setCorridor(Number(e.target.value))}
            aria-label="Corridor radius (miles)"
          >
            {CORRIDOR_OPTIONS.map((mi) => (
              <option key={mi} value={mi}>
                within {mi} mi
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary trip-submit" onClick={handlePlan}>
          Plan trip
        </button>
      </div>

      <p className="trip-empty">
        Routing isn&rsquo;t wired up yet — this view will show matching tracks once trip planning is enabled.
      </p>
    </section>
  );
}
