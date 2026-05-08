import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type Track = {
  slug: string;
  url: string;
  name: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  surface?: 'dirt' | 'carpet' | 'asphalt' | 'turf' | 'unknown';
  indoor?: boolean;
  lat?: number;
  lon?: number;
  scrapedAt?: string;
  fetchError?: string;
  geocodeError?: string;
};

const CANDIDATES = ['../data/tracks.geocoded.json', '../data/tracks.json'];

export async function loadTracks(): Promise<Track[]> {
  for (const rel of CANDIDATES) {
    try {
      const text = await readFile(resolve(process.cwd(), rel), 'utf-8');
      return JSON.parse(text) as Track[];
    } catch {
      // try next
    }
  }
  return [];
}
