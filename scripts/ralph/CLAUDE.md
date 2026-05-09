# Ralph Agent Instructions — rc-tracks Trip Planner

You are an autonomous coding agent. Your job is to implement ONE user story per iteration from the PRD, commit it, and exit. Another iteration will pick up the next story.

## Working environment

- Working directory: `/Users/henryrobinson/code/github/rc-tracks`
- Branch: `main` (no feature branches; commit straight to main)
- Production: https://rc-tracks.vercel.app — auto-deploys from `git push`
- All app code lives in `site/`. Do NOT touch `scraper/` or `site/data/`.

cd into the working directory at the start of each iteration. Use absolute paths in tool calls if you need to.

## Your workflow each iteration

1. `cd /Users/henryrobinson/code/github/rc-tracks`
2. Read `scripts/ralph/prd.json` — that's the work list.
3. Read `scripts/ralph/progress.txt` — codebase patterns + prior progress (skim the "Codebase Patterns" section at the top first).
4. Pick the **lowest-numbered** story where `passes: false`. Lower priority number = do this first.
5. Implement that ONE story. Don't bundle multiple stories.
6. Run `bash scripts/ralph/quality-check.sh` from repo root. Both `npx tsc --noEmit` and `npm run build` (in `site/`) must succeed. If they fail, fix and retry until they pass.
7. Stage and commit ALL changes (`git add -A`). Commit message format:
   ```
   feat(trip-planner): [STORY-ID] - [Story Title]
   ```
   No Co-Authored-By trailers.
8. Push: `git push origin main`. (Vercel auto-deploys.)
9. Update `scripts/ralph/prd.json`: set `passes: true` for the story you just completed. Use `jq` to do this safely:
   ```sh
   jq '.stories |= map(if .id == "STORY-ID" then .passes = true else . end)' scripts/ralph/prd.json > /tmp/prd.new && mv /tmp/prd.new scripts/ralph/prd.json
   ```
10. Append to `scripts/ralph/progress.txt`:
    ```
    ## [ISO-timestamp] - [STORY-ID]
    - Brief summary of what changed
    - Files modified
    - **Learnings:**
      - Any reusable patterns or gotchas for the next iteration
    ---
    ```
11. Commit + push the prd.json + progress.txt update with a follow-on commit:
    ```
    chore(ralph): mark STORY-ID complete
    ```
12. Check whether ALL stories now have `passes: true`. If yes, end your response with literally:
    `<promise>COMPLETE</promise>`
    If no, end normally — the next ralph iteration will continue.

## Project context (read before changing code)

The site is a Next.js 15 static export. Key files to know about:

- `site/app/page.tsx` — server component, loads tracks from `site/data/tracks.geocoded.json`.
- `site/app/track-browser.tsx` — main client component. Holds all filter state and the view toggle (currently `list` | `map`). Pipes filtered tracks into either the list of cards or the map.
- `site/app/map-view.tsx` — client-only Leaflet map, dynamically imported. Uses `react-leaflet` + `leaflet.markercluster`. Already supports a center marker + radius circle for the existing distance filter.
- `site/lib/tracks.ts` — `Track` type and `loadTracks()` helper.
- `site/lib/geo.ts` — `LatLon`, `haversineMiles`, `geocode()` (Nominatim with localStorage cache), `getCurrentPosition()`. **Add new geo helpers here, not in random files.**
- `site/app/globals.css` — all styles. **Never use inline styles.** Add new classes here.

## Codebase conventions

- Client components MUST start with `'use client';`.
- Map and other browser-only modules are loaded via `dynamic(() => import(...), { ssr: false })`.
- localStorage caching follows the pattern in `lib/geo.ts` (CACHE_KEY constant + JSON.parse fallback).
- Filter state lives in TrackBrowser; computed lists use `useMemo`.
- TypeScript strict mode is on. Don't use `any` — prefer `unknown` and narrow.
- Mobile-first CSS. Default styles for ≤720px, then `@media (min-width: 720px)` for larger.
- Touch targets ≥44px high. Inputs use `min-height: 44px`.
- Don't add new top-level dependencies unless the story requires it. Check `site/package.json` first.

## Commit hygiene

- Make a NEW commit per story (never amend across stories).
- Don't run destructive git commands (`reset --hard`, `push --force`, etc.).
- If quality-check fails, FIX the code; never `--no-verify`.
- One feature commit + one chore(ralph) bookkeeping commit per story is fine.

## Honesty rules

- If a step failed and you can't tell why, **stop the iteration and explain in progress.txt**. Don't mark the story passes:true.
- If you skipped a step (e.g., couldn't browser-test), say so in progress.txt.
- Don't claim a fix worked unless `quality-check.sh` returned 0.

## Stop condition

After your single story is done and committed, check the PRD. If every story has `passes: true`, end with `<promise>COMPLETE</promise>`. Otherwise, just finish your response — the loop runner picks up the next iteration.
