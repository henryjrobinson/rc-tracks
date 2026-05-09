export type LatLon = { lat: number; lon: number };

export type GeocodeResult = LatLon & { displayName: string };

const EARTH_MI = 3958.7613;
const CACHE_KEY = 'rc-tracks:geocode-cache:v1';
const CACHE_LIMIT = 200;

export function haversineMiles(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_MI * Math.asin(Math.sqrt(h));
}

type Cache = Record<string, { result: GeocodeResult | null; cachedAt: number }>;

function loadCache(): Cache {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  if (typeof localStorage === 'undefined') return;
  const entries = Object.entries(cache).sort((a, b) => b[1].cachedAt - a[1].cachedAt);
  const trimmed = Object.fromEntries(entries.slice(0, CACHE_LIMIT));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota — ignore
  }
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  const key = q.toLowerCase();
  const cache = loadCache();
  const hit = cache[key];
  if (hit) return hit.result;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const top = data[0];
  const result: GeocodeResult | null = top
    ? { lat: Number(top.lat), lon: Number(top.lon), displayName: top.display_name }
    : null;

  cache[key] = { result, cachedAt: Date.now() };
  saveCache(cache);
  return result;
}

export type Route = { polyline: LatLon[]; distanceMi: number; durationMin: number };

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    geometry?: { coordinates?: Array<[number, number]> };
    distance?: number;
    duration?: number;
  }>;
};

/** Fetch a driving route from OSRM (public demo server). Returns null if no route exists. */
export async function getRoute(start: LatLon, end: LatLon, signal?: AbortSignal): Promise<Route | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Routing failed: HTTP ${res.status}`);
  const data = (await res.json()) as OsrmResponse;
  const route = data.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!route || !coords || coords.length === 0) return null;
  const polyline: LatLon[] = coords.map(([lon, lat]) => ({ lat, lon }));
  return {
    polyline,
    distanceMi: (route.distance ?? 0) / 1609.344,
    durationMin: (route.duration ?? 0) / 60,
  };
}

/**
 * Minimum great-circle distance (miles) from a point to a polyline.
 * Projects onto each segment using an equirectangular approximation at the
 * segment midpoint, clamps to the segment, then measures with haversine.
 */
export function pointToPolylineMiles(p: LatLon, polyline: LatLon[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMiles(p, polyline[0]);

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = haversineMiles(p, closestPointOnSegment(p, polyline[i], polyline[i + 1]));
    if (d < min) min = d;
  }
  return min;
}

function closestPointOnSegment(p: LatLon, a: LatLon, b: LatLon): LatLon {
  const cosMidLat = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const ax = a.lon * cosMidLat;
  const ay = a.lat;
  const bx = b.lon * cosMidLat;
  const by = b.lat;
  const px = p.lon * cosMidLat;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) };
}

export function getCurrentPosition(): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Location request failed')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
