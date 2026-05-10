import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from './http.js';
import { inferSurface } from './parseTrack.js';
import type { GeocodedTrack } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../site/data');
const FILE = resolve(DATA_DIR, 'tracks.geocoded.json');

const KEY = process.env.BRAVE_SEARCH_API_KEY;
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';
const DELAY_MS = 1100;

type BraveResult = {
  web?: { results?: Array<{ title?: string; description?: string }> };
};

async function main() {
  if (!KEY) {
    console.error('Missing BRAVE_SEARCH_API_KEY env var.');
    process.exit(1);
  }

  const tracks: GeocodedTrack[] = JSON.parse(await readFile(FILE, 'utf-8'));
  const candidates = tracks.filter(
    (t) => !t.fetchError && t.surface === 'unknown' && (t.city || t.country),
  );
  console.log(`Total tracks: ${tracks.length}`);
  console.log(`Candidates with surface=unknown after website pass: ${candidates.length}`);

  let queried = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const track = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    const q = buildQuery(track);
    try {
      queried++;
      const text = await braveSearch(q);
      const surface = inferSurface(text);
      if (surface !== 'unknown') {
        track.surface = surface;
        track.surfaceSource = 'brave';
        updated++;
        console.log(`${progress} ${track.slug} → ${surface}`);
      } else {
        console.log(`${progress} ${track.slug} — no surface keyword in snippets`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${progress} ${track.slug} — failed: ${msg.slice(0, 80)}`);
    }

    if (updated % 25 === 0 && updated > 0) {
      await writeFile(FILE, JSON.stringify(tracks, null, 2));
    }
    if (i < candidates.length - 1) await sleep(DELAY_MS);
  }

  await writeFile(FILE, JSON.stringify(tracks, null, 2));
  console.log(`\nQueried: ${queried}, updated: ${updated}, failed: ${failed}`);
}

function buildQuery(track: GeocodedTrack): string {
  const parts = [track.name, track.city, track.state, 'rc track surface'].filter(Boolean);
  return parts.join(' ');
}

async function braveSearch(q: string): Promise<string> {
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&count=5&safesearch=moderate`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': KEY!,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as BraveResult;
  const results = data.web?.results ?? [];
  return results.map((r) => `${r.title ?? ''} ${r.description ?? ''}`).join(' ');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
