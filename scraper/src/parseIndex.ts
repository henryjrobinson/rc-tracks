import * as cheerio from 'cheerio';
import type { IndexEntry } from './types.js';

const SUBDOMAIN = /^\/\/([a-z0-9][a-z0-9-]*)\.liverc\.com\/?$/i;

const RESERVED = new Set(['live', 'www', 'live2', 'forum', 'help', 'blog', 'liverc']);

export function parseIndex(html: string): IndexEntry[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, IndexEntry>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = SUBDOMAIN.exec(href);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (RESERVED.has(slug)) return;
    if (seen.has(slug)) return;

    const name = $(el).find('strong').first().text().trim();
    if (!name) return;

    seen.set(slug, {
      slug,
      url: `https://${slug}.liverc.com/`,
      name,
    });
  });

  return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
