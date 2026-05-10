import * as cheerio from 'cheerio';
import type { IndexEntry, LiveStatus } from './types.js';

const SUBDOMAIN_HREF = /^\/\/([a-z0-9][a-z0-9-]*)\.liverc\.com\/?$/i;
const SUBDOMAIN_DATA = /^\/\/([a-z0-9][a-z0-9-]*)\.liverc\.com\//i;
const RESERVED = new Set(['live', 'www', 'live2', 'forum', 'help', 'blog', 'liverc']);
const AGO_RE = /^\s*(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago\s*$/i;

export function parseIndex(html: string, now: Date = new Date()): IndexEntry[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, IndexEntry>();

  $('tr.clickable-row').each((_, row) => {
    const $row = $(row);
    const dataHref = $row.attr('data-href') ?? '';
    const slugFromData = SUBDOMAIN_DATA.exec(dataHref)?.[1]?.toLowerCase();

    const $nameLink = $row.find('a').filter((_, a) => SUBDOMAIN_HREF.test($(a).attr('href') ?? '')).first();
    const slug = slugFromData ?? SUBDOMAIN_HREF.exec($nameLink.attr('href') ?? '')?.[1]?.toLowerCase();
    if (!slug || RESERVED.has(slug) || seen.has(slug)) return;

    const name = $nameLink.find('strong').first().text().trim();
    if (!name) return;

    const currentEvent = $nameLink.parent().find('small').first().text().trim() || undefined;

    const $statusCell = $row.children('td').first();
    const statusClasses = $statusCell.find('i').toArray().flatMap((el) => ($(el).attr('class') ?? '').split(/\s+/));
    const liveStatus = inferLiveStatus(statusClasses);

    const lastActiveText = $statusCell.find('small small').first().text().trim() || undefined;
    const lastActiveAt = lastActiveText ? approxIso(lastActiveText, now) : undefined;

    seen.set(slug, {
      slug,
      url: `https://${slug}.liverc.com/`,
      name,
      liveStatus,
      lastActiveText,
      lastActiveAt,
      currentEvent,
    });
  });

  if (seen.size === 0) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const m = SUBDOMAIN_HREF.exec(href);
      if (!m) return;
      const slug = m[1].toLowerCase();
      if (RESERVED.has(slug) || seen.has(slug)) return;
      const name = $(el).find('strong').first().text().trim();
      if (!name) return;
      seen.set(slug, { slug, url: `https://${slug}.liverc.com/`, name });
    });
  }

  return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function inferLiveStatus(classes: string[]): LiveStatus {
  const has = (s: string) => classes.includes(s);
  if (has('status_2') || classes.some((c) => c.startsWith('fa-flag'))) return 'race';
  if (has('status_1') || classes.some((c) => c.startsWith('fa-hourglass'))) return 'live';
  if (has('status_0') || classes.some((c) => c.startsWith('fa-power-off'))) return 'idle';
  return 'unknown';
}

function approxIso(text: string, now: Date): string | undefined {
  const m = AGO_RE.exec(text);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = unitMs(unit) * n;
  return new Date(now.getTime() - ms).toISOString();
}

function unitMs(unit: string): number {
  switch (unit) {
    case 'second': return 1000;
    case 'minute': return 60_000;
    case 'hour': return 3_600_000;
    case 'day': return 86_400_000;
    case 'week': return 7 * 86_400_000;
    case 'month': return 30 * 86_400_000;
    case 'year': return 365 * 86_400_000;
    default: return 0;
  }
}
