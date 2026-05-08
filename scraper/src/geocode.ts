import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJson, sleep } from './http.js';
import type { Track, GeocodedTrack } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../site/data');
const IN = resolve(DATA_DIR, 'tracks.json');
const OUT = resolve(DATA_DIR, 'tracks.geocoded.json');
const CACHE = resolve(DATA_DIR, 'geocode-cache.json');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const DELAY_MS = 1100;

type CacheEntry = { lat?: number; lon?: number; queriedAt: string; query: string; error?: string };
type Cache = Record<string, CacheEntry>;
type NominatimResult = { lat: string; lon: string };

async function main() {
  const tracks: Track[] = JSON.parse(await readFile(IN, 'utf-8'));
  const cache: Cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf-8')) : {};

  let hits = 0;
  let misses = 0;
  let failures = 0;
  const out: GeocodedTrack[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const query = buildQuery(track);
    const progress = `[${i + 1}/${tracks.length}]`;

    if (!query) {
      out.push(track);
      console.log(`${progress} ${track.slug} — skipped (no address)`);
      continue;
    }

    if (cache[query]) {
      const c = cache[query];
      hits++;
      out.push({ ...track, lat: c.lat, lon: c.lon, geocodedAt: c.queriedAt, geocodeError: c.error });
      continue;
    }

    misses++;
    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const results = await fetchJson<NominatimResult[]>(url);
      const top = results[0];
      const entry: CacheEntry = top
        ? { lat: Number(top.lat), lon: Number(top.lon), queriedAt: new Date().toISOString(), query }
        : { queriedAt: new Date().toISOString(), query, error: 'no result' };
      cache[query] = entry;
      out.push({ ...track, lat: entry.lat, lon: entry.lon, geocodedAt: entry.queriedAt, geocodeError: entry.error });
      const loc = top ? `${entry.lat?.toFixed(3)}, ${entry.lon?.toFixed(3)}` : 'no result';
      console.log(`${progress} ${track.slug} — ${loc}`);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      cache[query] = { queriedAt: new Date().toISOString(), query, error: msg };
      out.push({ ...track, geocodeError: msg, geocodedAt: new Date().toISOString() });
      console.warn(`${progress} ${track.slug} — FAILED: ${msg}`);
    }

    if (misses % 20 === 0) await writeFile(CACHE, JSON.stringify(cache, null, 2));
    await sleep(DELAY_MS);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CACHE, JSON.stringify(cache, null, 2));
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${out.length} tracks to ${OUT}`);
  console.log(`Cache hits: ${hits}, misses: ${misses}, failures: ${failures}`);
}

function buildQuery(track: Track): string | undefined {
  const parts = [track.street, track.city, track.state, track.postalCode, track.country]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  if (parts.length === 0) return undefined;
  if (parts.length === 1 && parts[0].length < 4) return undefined;
  return parts.join(', ');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
