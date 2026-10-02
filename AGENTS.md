# Warehouse Map Live — agent context

Read this file when starting without conversation history. Update it when the
layout, data contract, or user-facing behavior changes materially. Inspect the
current files before editing: the user also changes code directly.

## Purpose and stack

This is an interactive warehouse floor map built with plain JavaScript, CSS,
and Vite. It displays inventory, dock orders, order-source connections, and
physical-count discrepancies. There is no framework, backend, or real warehouse
integration yet. `public/inventory.json` is explicitly labeled demo data.

- `npm install` installs dependencies; retain `package-lock.json`.
- `npm run dev` starts Vite on port 5174 with live updates.
- `npm run build` writes the production build to `dist/`.
- `npm run preview` serves the build on port 4173.
- `.github/workflows/deploy.yml` builds and publishes `dist/` on pushes to `main`;
  GitHub Pages must use the GitHub Actions source. Never publish the source root
  `index.html` directly. Relative Vite asset paths support the project site URL.
- `npm run deploy` is the alternative manual `gh-pages` branch deployment;
  that method requires Pages to serve the `gh-pages` branch root.
- `.gitignore` excludes dependencies, builds, logs, and local environment files.

## Layout requirements

- P, Q, and R use the same section width as B–N in detailed and fitted views.
  Their A–E sub-bays share the standard numbered bay footprint; do not widen
  the sections to give each suffix its own full-width bay.

- In the current mode without orders, the fitted floor has exactly three rows:
  dock doors, access aisle, and storage filling the remaining height. Restore
  the 44px order row only together with the dock-orders element; an unused row
  places storage in the aisle track and collapses the bay columns.

- Sixteen sections run horizontally: A–H, J–N, and P–R. **Skip I and O.** P, Q, and R extend right of N and span the full warehouse height.
- Each section has two columns, numbered downward. Use uppercase section letters
  and three-digit numbers everywhere, including inventory keys.
- Section A has an outer A-side lane with `A101`–`A112`; its inner left
  column has `A001`–`A021`, an open crossing at positions 022–023, then
  `A024`–`A030`.
- Right column: `A141`, `A041`–`A061`, an open crossing at positions 062–063,
  then `A064`–`A070`.
- The standard layout has **58 main bays per section**. P, Q, and R extend
  right of N at the full warehouse height. Each P–R main bay has five distinct
  data locations ending A–E (for example, `P028A`–`P028E`); display only the
  parent label `P028`. Section A has 11 additional A-side bays, A102–A112, for
  1,635 total map locations. Each column occupies 31 grid positions.
- A vertical forklift aisle separates each column pair. Crossings line up
  horizontally across all sections.
- Dock positions run across the top, numbered 1–48. Leave 22–27 blank.
  The user changed the dock header to descend **48 to 1**; preserve that direction.
- The horizontal aisle below the dock/order area is four times the vertical
  aisle width, in both normal and fitted views.
- The staging/receiving area was explicitly removed. Do not reintroduce it.

## Main files

- `src/main.js`: renders the shell, doors, bays, and inventory; fetches data;
  handles fit view, count display, selected bays, and inventory tooltips.
- `src/orders.js`: order buttons, SVG arrows, hover interactions, model search,
  result pagination, bay tracing, and discrepancy tracing.
- `src/counts.js`: validates physical counts and compares quantities by model.
- `src/preferences.js`: validates and saves browser preferences.
- `src/style.css`: both detailed and fit-to-screen layouts and visual states.
- `public/inventory.json`: editable demo inventory, orders, and physical counts.
- `vite.config.js`: network binding and fixed development/preview ports.
- `README.md`: setup, data contracts, and feature usage.

## Data contracts

The app polls every five seconds after the preceding request completes. The
default endpoint is `inventory.json` under the Vite base path. Override it with
`VITE_INVENTORY_URL` in `.env.local` and restart Vite. Do not put secrets in Vite
environment variables; they are browser-visible. Remote endpoints need suitable
CORS access. Failed requests retain the last valid data and show an error state.

The response has these fields:

```json
{
  "demo": true,
  "bays": {
    "A101": [],
    "A001": [{ "model": "MX-108", "quantity": 19 }]
  },
  "orders": [{
    "id": "SO-011",
    "dock": 1,
    "sources": [{ "bay": "A001", "model": "MX-108", "quantity": 4 }]
  }],
  "counts": {
    "A001": [{ "model": "MX-108", "quantity": 16 }]
  }
}
```

This example omits most bays for brevity; actual responses must include all 1,635
storage bay keys. Quantities are nonnegative safe integers.

- `bays`: current system inventory; an empty array means empty.
- `orders`: optional array. IDs must be unique; docks are 1–21 or 28–48.
  Source quantities are allocations to that order, not current stock. Legacy
  bay-only sources can be traced but cannot match a model search. Missing
  quantities remain unknown; never invent them from current inventory.
- `counts`: optional map of complete physical counts. An omitted bay is
  uncounted; `[]` means physically counted and empty. Missing models in a counted
  bay have physical quantity zero. Sum duplicate models before comparison.
  Compare by model, so opposite discrepancies do not cancel each other.
- Demo counts intentionally contain **15 discrepant bays** (user expects about
  15 ± 5). Newly added 101/141 bays start empty and uncounted.

## Interaction requirements

Current limited mode: startup forces fit view and count view on. The toolbar
contains only fit, a single show/hide counts toggle, and upload controls, plus
an inventory model search field. Model search adds a blue dot beside matching
bay labels, excluding P, Q, and R from the dot indicators. Colors and brightness
stay unchanged. Dots remain visible in fitted/mobile views and disappear when
search is cleared. Search matches bay inventory directly; the match summary
still includes all sections.
Order/search/tracing startup is intentionally commented out in `src/main.js`;
`src/orders.js` remains intact. Restore its commented import and `setupOrders`
call to re-enable the order UI and tracing. Activity heatmap controls and
processing are temporarily suspended.

- First visits default to fit view. In current limited mode startup always
  forces fit view and count display on; selected bay and model search persist.
  Fit view hides inventory inside bays; hover, focus, or tap exposes full details.
  Detailed view allows horizontal scrolling and reduces crowded inventory text.
- Hover/focus an order to draw curved arrows **from source bays toward the order**.
  Pointer leave/blur ends the temporary preview. The user replaced the earlier
  press-and-hold interaction with hover. Lines describe provenance, not driving
  paths through warehouse aisles.
- Typing in model search shows matching model suggestions in alphabetical
  order, including known LG appliance examples; selecting a model filters the
  case-insensitive partial matches. Show matching orders and bay/model
  allocation quantities on the arrows. Results have five orders per page;
  pagination does not limit map connections. Reset to page one on a new query
  and clamp the page if live results shrink.
- `Trace bay orders`: enable, then click a bay to keep its order connections
  visible. Hovering an order temporarily previews it; leaving restores the trace.
- `Trace off counts`: highlight discrepant bays and connect affected bay/model
  pairs to related orders. It and individual bay tracing are mutually exclusive.
  Both tracing modes respect model search. A discrepant bay may have no matching
  order source; do not fabricate a connection.
- `Show counts`: matched bays green, discrepancies red, uncounted bays yellow
  with a dark gold border. There is no separate counted/uncounted focus control.
  Tooltips show system amount, physical amount, and shortage/overage. This toggle
  only changes display; it does not record counts or change inventory.

## Persistence

Use localStorage key `warehouse-map.preferences.v1`. Persist fit view, count
display, selected bay, model search, results page, results expansion, tracing
mode, and traced bay. Do not persist temporary order hover or inventory snapshots.
Validate stored values and tolerate blocked storage or invalid JSON. Initialize
controls and their `aria-pressed` values consistently. Restore search pagination
after data arrives so it is not prematurely reset against an empty order list.
Preferences belong to the browser and origin; localhost and the VPN IP have
separate storage.

## Network and maintenance notes

Vite binds `0.0.0.0` with `strictPort: true`. The last observed Tailscale address
was `100.115.64.48`, giving `http://100.115.64.48:5174/`. Verify the address if
troubleshooting; it is machine-specific. Preserve VPN access and avoid a
`--host 127.0.0.1` override on the user's dev server.

Check existing processes before starting another dev server. Browser automation
has used Playwright available from `/home/brady/node_modules` and Chrome at
`/usr/bin/google-chrome-stable`; neither is a declared project dependency. The
sandbox may require escalation to launch Chrome or listen on network ports.
There is no committed automated test suite. Use checks proportional to changes.

Known alignment issue to inspect before changing dock layout: `main.js` renders
doors from 48 to 1, while `orders.js` currently creates stacks from 1 to 48.
Avoid assuming their visual positions already match.

ResizeObserver changes to the aisle CSS width should be guarded and scheduled
in an animation frame to avoid observer-loop errors during fit-view changes.

## Activity heatmap

`src/activity.js` validates and indexes optional `activity` records and computes
recency bands from each bay's latest event: ≤15 min hot, ≤1 hr warm, ≤4 hr mild,
≤24 hr cool, older/missing neutral. Records use `{ bay, type, at, model?, quantity? }`;
`at` must be ISO with a timezone. Ignore future events until their time arrives.
`src/main.js` polls these records with inventory and refreshes live heat colors
every 30 seconds. Tooltips include the latest event and its timestamp, optional
model/quantity, and 24-hour event count. This is recency, not event-volume heat.

Heatmap selection is saved as `showActivity`. Enabling it turns count colors off;
enabling count colors turns heatmap off. Keep tracing overlays functional. Demo
activity is deliberately a fixed snapshot (`demo: true`, `activityAsOf`), labeled
as such in the legend/summary and tooltips; never present it as current live
activity. Real activity uses browser time. Do not synthesize activity from stock
levels or order allocations. Preserve an informative legend in mobile fit view.

**Trace off bays in recent orders** is a separate persisted trace mode
(`traceMode: "recent-off"`). It intersects off-count bay/model pairs with order
sources and orders created in the last 24 hours. Orders need timezone-qualified
`createdAt`; older or undated orders still work with ordinary order tracing.
The demo assigns `createdAt` relative to its fixed `activityAsOf` snapshot.
Keep count and single-bay tracing mutually exclusive with this mode, respect
model search, update the recent-order set as live time advances, and retain it
across reloads.

## Excel count sample

`public/samples/lg-200-model-counts.xlsx` is an upload-ready, first-sheet count
sample containing 200 distinct LG appliance models across all 1,635 locations. It has
1,464 matches, 30 discrepancies, one partial bay, and 139 uncounted locations.
All quantities and assignments are synthetic. Its source worksheet records LG
product URLs; models include older/discontinued appliances. Regenerate with
`node scripts/generate-lg-count-sample.mjs`; the source catalog is
`public/samples/lg-model-sources.json`. The sample uses the supported flat header
`Count Qty A-B` and a single `Task System Qty` column. P–R locations use suffixes A–E; `Status: Partial` colors that sub-bay and outlines its parent bay yellow. The current upload handler
updates count colors, model totals, and offset arrows; visible labels omit P–R sub-bay letters. Model labels
and order tracing still use the feed.

## Miscount model totals

`src/miscounts.js` aggregates model/location quantities for the **Miscount models**
dialog. It lists only models with a location discrepancy, split into totals that
match system and totals that differ or are incomplete. Totals span all locations
in the active source, not just discrepant locations. Uploads retain model rows
and use file system/count quantities; feed mode uses inventory/counts. Duplicate
model/location rows are summed before checking discrepancies. Missing counts or
partial rows prevent a balanced classification. The dialog shows totals, signed
differences, and full location IDs (including P–R suffixes), works in fit view,
and ignores the map search. File totals cover listed locations only.


Miscount arrows (`src/offset-pairs.js`) show possible exact offsets
for the same model at any two locations, regardless of distance. Purple arrows point from extra to
short; no inventory or physical counts are corrected automatically. Candidates
require complete counts at both endpoints and equal, opposite differences after
summing duplicate rows. All candidates are shown if a bay has multiple possible
matches. Pair matching has no adjacency or distance restriction. P–R suffix locations remain distinct.
Arrows stay visible regardless of count visibility or model search and resize with the floor. Bay
details (even with counts hidden) and the miscount dialog describe the model, quantity, and endpoints.
Both the live demo and generated workbook include B005 → B006 (vertical, 4 units)
and D010 → D050 (horizontal, 3 units), plus B008 → M055 (distant, 5 units). Live demo still has 15 discrepant bays;
the workbook now has 34. Re-upload the regenerated workbook to replace a previous
session upload.
