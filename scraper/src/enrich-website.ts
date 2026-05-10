import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, sleep } from './http.js';
import { inferSurface } from './parseTrack.js';
import type { GeocodedTrack } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../site/data');
const FILE = resolve(DATA_DIR, 'tracks.geocoded.json');

const DELAY_MS = 1000;
const PER_SITE_TIMEOUT = 12_000;
const MAX_BYTES = 600_000;

async function main() {
  const tracks: GeocodedTrack[] = JSON.parse(await readFile(FILE, 'utf-8'));
  const candidates = tracks.filter((t) => t.website && t.surface !== 'carpet' && t.surface !== 'dirt' && t.surface !== 'asphalt' && t.surface !== 'turf');
  console.log(`Total tracks: ${tracks.length}`);
  console.log(`Candidates with website + unknown surface: ${candidates.length}`);

  let updated = 0;
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const track = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;
    const url = track.website!;
    try {
      fetched++;
      const html = await fetchTextLimited(url, PER_SITE_TIMEOUT, MAX_BYTES);
      const text = stripHtml(html);
      const surface = inferSurface(text);
      if (surface !== 'unknown') {
        track.surface = surface;
        track.surfaceSource = 'website';
        updated++;
        console.log(`${progress} ${track.slug} → ${surface}`);
      } else {
        console.log(`${progress} ${track.slug} — no surface keyword on site`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${progress} ${track.slug} — fetch failed: ${msg.slice(0, 80)}`);
    }

    if (updated % 25 === 0 && updated > 0) {
      await writeFile(FILE, JSON.stringify(tracks, null, 2));
    }
    if (i < candidates.length - 1) await sleep(DELAY_MS);
  }

  await writeFile(FILE, JSON.stringify(tracks, null, 2));
  console.log(`\nFetched: ${fetched}, updated: ${updated}, failed: ${failed}`);
  console.log(`Wrote ${tracks.length} tracks to ${FILE}`);
}

async function fetchTextLimited(url: string, timeoutMs: number, maxBytes: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'rc-tracks-enricher/0.1 (+https://github.com/henryjrobinson/rc-tracks; henryjrobinson@gmail.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    return body.length > maxBytes ? body.slice(0, maxBytes) : body;
  } finally {
    clearTimeout(t);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
