import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchText, sleep } from './http.js';
import { parseIndex } from './parseIndex.js';
import { parseTrack } from './parseTrack.js';
import type { Track } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../../site/data');
const OUT = resolve(DATA_DIR, 'tracks.json');
const INDEX_URL = 'https://live.liverc.com/';

const DELAY_MS = 1000;
const MAX_RETRIES = 2;

async function main() {
  const args = new Set(process.argv.slice(2));
  const sample = args.has('--sample');
  const limit = sample ? 5 : Infinity;

  console.log('Fetching index…');
  const indexHtml = await fetchText(INDEX_URL);
  const entries = parseIndex(indexHtml);
  console.log(`Found ${entries.length} tracks${sample ? ` (sampling ${limit})` : ''}.`);

  const subset = entries.slice(0, limit === Infinity ? entries.length : Number(limit));
  const tracks: Track[] = [];
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < subset.length; i++) {
    const entry = subset[i];
    const progress = `[${i + 1}/${subset.length}]`;
    try {
      const html = await withRetry(() => fetchText(entry.url));
      const track = parseTrack(entry, html, new Date().toISOString());
      tracks.push(track);
      ok++;
      const loc = [track.city, track.state, track.countryCode].filter(Boolean).join(', ');
      console.log(`${progress} ${entry.slug} — ${track.name}${loc ? ` (${loc})` : ''}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      tracks.push({ ...entry, scrapedAt: new Date().toISOString(), fetchError: msg });
      console.warn(`${progress} ${entry.slug} — FAILED: ${msg}`);
    }
    if (i < subset.length - 1) await sleep(DELAY_MS);
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(tracks, null, 2));
  console.log(`\nWrote ${tracks.length} tracks to ${OUT}`);
  console.log(`OK: ${ok}, failed: ${failed}`);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
