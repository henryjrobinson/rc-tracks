import * as cheerio from 'cheerio';
import type { IndexEntry, Track } from './types.js';

const TITLE_SUFFIX = / :: Broadcast and Results :: LiveRC$/i;
const NOSPAM = /noSpam\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/i;
const MAPS_Q = /[?&]q=([^&"']+)/;
const CONTACT_PREFIX = /^(P|W|E):/i;

export function parseTrack(entry: IndexEntry, html: string, scrapedAt: string): Track {
  const $ = cheerio.load(html);

  const titleName = $('title').first().text().trim().replace(TITLE_SUFFIX, '').trim();
  const name = titleName || entry.name;

  const addressEl = $('address').first();
  const lines = extractAddressLines($, addressEl);
  const { street, city, state, postalCode, country } = extractFromLines(lines);

  const phone = addressEl.find('a[href^="tel:"]').first().attr('href')?.replace(/^tel:\s*/i, '').trim();

  const websiteRaw = addressEl
    .find('a[target="_blank"]')
    .toArray()
    .map((a) => $(a).attr('href') ?? '')
    .find((href) => /^https?:\/\//.test(href) && !/google\.com\/maps/i.test(href));
  const website = websiteRaw && !/^http:\/\/[^/]*@/.test(websiteRaw) ? websiteRaw : undefined;

  const email = extractEmail($, addressEl);

  const mapsHref = $('iframe[src*="google.com/maps"]').first().attr('src') ?? '';
  const mapsQ = MAPS_Q.exec(mapsHref)?.[1];
  const mapsAddress = mapsQ ? decodeURIComponent(mapsQ.replace(/\+/g, ' ')) : undefined;
  const countryCode = inferCountryCode(mapsAddress, country);

  const description = extractDescription($, addressEl);
  const surface = inferSurface(description ?? '');
  const indoor = /\bindoor\b/i.test(description ?? '');

  return {
    ...entry,
    name,
    street,
    city,
    state,
    postalCode,
    country,
    countryCode,
    phone,
    email,
    website,
    description: description?.slice(0, 800),
    surface,
    indoor,
    scrapedAt,
  };
}

function extractAddressLines($: cheerio.CheerioAPI, addressEl: cheerio.Cheerio<any>): string[] {
  const clone = addressEl.clone();
  clone.find('strong').remove();
  const html = clone.html() ?? '';
  return html
    .split(/<br\s*\/?>/i)
    .map((s) =>
      s
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function extractFromLines(lines: string[]): {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
} {
  const stop = lines.findIndex((l) => CONTACT_PREFIX.test(l));
  const addrLines = (stop === -1 ? lines : lines.slice(0, stop)).filter(Boolean);
  if (addrLines.length === 0) return {};

  if (addrLines.length === 1) return { street: addrLines[0] };

  const country = addrLines[addrLines.length - 1];
  const cityLine = addrLines[addrLines.length - 2];
  const street = addrLines.slice(0, -2).join(', ') || undefined;
  const parsed = parseCityStateZip(cityLine);

  return { street, ...parsed, country };
}

function parseCityStateZip(line: string): { city?: string; state?: string; postalCode?: string } {
  const us = /^(.+?),\s*([A-Z]{2})\s+([\dA-Z][\dA-Z\s-]{2,10})\s*$/.exec(line);
  if (us) return { city: us[1].trim(), state: us[2], postalCode: us[3].trim() };

  const cityStateZip = /^(.+?),\s*([^,]+?)\s+([A-Z\d][A-Z\d\s-]{2,10})\s*$/i.exec(line);
  if (cityStateZip) return { city: cityStateZip[1].trim(), state: cityStateZip[2].trim(), postalCode: cityStateZip[3].trim() };

  const ukLike = /^(.+?)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i.exec(line);
  if (ukLike) return { city: ukLike[1].trim(), postalCode: ukLike[2].replace(/\s+/g, ' ').toUpperCase() };

  const cityComma = /^(.+?),\s*(.+)$/.exec(line);
  if (cityComma) return { city: cityComma[1].trim(), state: cityComma[2].trim() };

  const trailingZip = /^(.+?)\s+(\S{3,10})\s*$/.exec(line);
  if (trailingZip && /\d/.test(trailingZip[2])) return { city: trailingZip[1].trim(), postalCode: trailingZip[2].trim() };

  return { city: line };
}

function extractEmail($: cheerio.CheerioAPI, addressEl: cheerio.Cheerio<any>): string | undefined {
  const inner = addressEl.html() ?? '';
  const m = NOSPAM.exec(inner);
  if (m) return `${decodeEntities(m[1])}@${decodeEntities(m[2])}`.toLowerCase();

  const visible = addressEl
    .find('a')
    .toArray()
    .map((a) => decodeEntities($(a).text() ?? ''));
  const direct = visible.find((t) => /\S+@\S+\.\S+/.test(t));
  return direct?.match(/\S+@\S+\.\S+/)?.[0]?.toLowerCase();
}

function extractDescription($: cheerio.CheerioAPI, addressEl: cheerio.Cheerio<any>): string | undefined {
  const sibling = addressEl
    .closest('.row')
    .nextAll('.row')
    .first()
    .find('.col-md-12')
    .first();

  if (sibling.length) {
    const clone = sibling.clone();
    clone.find('hr, script, style').remove();
    const text = clone.text().replace(/\s+/g, ' ').trim();
    if (text.length > 30) return text;
  }

  return undefined;
}

function decodeEntities(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function inferCountryCode(mapsAddr: string | undefined, country: string | undefined): string | undefined {
  if (mapsAddr) {
    const tail = mapsAddr.split(',').pop()?.trim().toUpperCase();
    if (tail && /^[A-Z]{2}$/.test(tail)) return tail;
  }
  if (!country) return undefined;
  const c = country.trim().toLowerCase();
  const map: Record<string, string> = {
    'united states': 'US',
    'united states of america': 'US',
    'usa': 'US',
    'u.s.a.': 'US',
    'canada': 'CA',
    'united kingdom': 'GB',
    'uk': 'GB',
    'great britain': 'GB',
    'england': 'GB',
    'scotland': 'GB',
    'wales': 'GB',
    'northern ireland': 'GB',
    'australia': 'AU',
    'new zealand': 'NZ',
    'germany': 'DE',
    'france': 'FR',
    'italy': 'IT',
    'spain': 'ES',
    'netherlands': 'NL',
    'belgium': 'BE',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'mexico': 'MX',
    'japan': 'JP',
    'china': 'CN',
    'south korea': 'KR',
    'korea': 'KR',
    'brazil': 'BR',
    'argentina': 'AR',
    'switzerland': 'CH',
    'austria': 'AT',
    'ireland': 'IE',
    'portugal': 'PT',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'poland': 'PL',
    'hungary': 'HU',
    'romania': 'RO',
    'thailand': 'TH',
    'singapore': 'SG',
    'malaysia': 'MY',
    'indonesia': 'ID',
    'philippines': 'PH',
    'vietnam': 'VN',
    'india': 'IN',
    'south africa': 'ZA',
    'israel': 'IL',
    'turkey': 'TR',
    'russia': 'RU',
    'ukraine': 'UA',
  };
  return map[c];
}

function inferSurface(text: string): Track['surface'] {
  const t = text.toLowerCase();
  if (/\bcarpet\b/.test(t)) return 'carpet';
  if (/\bdirt\b/.test(t) || /\bclay\b/.test(t)) return 'dirt';
  if (/\basphalt\b/.test(t) || /\btarmac\b/.test(t)) return 'asphalt';
  if (/\bturf\b/.test(t) || /astro\s*turf/.test(t)) return 'turf';
  return 'unknown';
}
