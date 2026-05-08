# rc-tracks

Worldwide directory of RC racing tracks, scraped from [LiveRC](https://live.liverc.com/).

## Layout

- `scraper/` — Node/TypeScript crawler. Fetches the LiveRC index, then each track subdomain, and writes structured JSON.
- `site/` — Next.js search site. Reads its own `site/data/*.json` at build time.
- `site/data/` — Output: `tracks.json` (raw scrape) and `tracks.geocoded.json` (with lat/lng).

## Scraper

```sh
cd scraper
npm install
npm run crawl       # writes ../site/data/tracks.json
npm run geocode     # writes ../site/data/tracks.geocoded.json (uses Nominatim, ~1 req/sec)
```

The crawl is polite: 1s delay between requests, identifying User-Agent. Total runtime ~20 min for ~1100 tracks.

## Site

```sh
cd site
npm install
npm run dev
```

Static export, no backend. Deploys free on Vercel.

## Refresh

A weekly GitHub Action re-runs the crawler and commits updated JSON.
