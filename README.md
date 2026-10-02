# Warehouse Map Live

A Node.js project using Vite with plain JavaScript and CSS.

## Development

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Saved changes to HTML, JavaScript, and CSS
automatically update the browser while the development server is running.

## Production

```sh
npm run build
npm run preview
```

The production build is written to `dist/`. The preview command serves that build locally.

### GitHub Pages

In the repository's **Settings → Pages → Build and deployment**, set **Source**
to **GitHub Actions**. Commit and push `.github/workflows/deploy.yml` to `main`.
The workflow installs dependencies, builds the app, and publishes the complete
`dist/` directory on each push to `main`. It can also be run manually from the
Actions tab. The project site is https://bradenripple5.github.io/warehouse-tracker/.

The root `index.html` is Vite's development entry and references `/src/main.js`.
Publishing it directly (or copying only the built HTML) causes missing JavaScript
errors. The deployed site needs the built `index.html`, `assets/`, and the copied
public files, including `inventory.json`. The existing relative `base: './'`
keeps asset and inventory URLs under the project site path.

The existing `npm run deploy` command is an alternative manual deployment: it
builds and pushes `dist/` to the `gh-pages` branch. For that method, set Pages to
**Deploy from a branch → gh-pages → / (root)** instead of GitHub Actions.

Git ignores installed dependencies (`node_modules/`), build output, logs, and local
environment files. Commit `package-lock.json` to keep dependency installs reproducible.

## Warehouse inventory

The map repeats 16 sections horizontally: A–H, J–N, and P–R (skipping I and O).
Each standard section has two vertical columns, numbered from top to bottom:
101, then 001–021, a crossing, then 024–030 on the left; 141, then 041–061,
a crossing, then 064–070 on the right. The columns have a forklift aisle between
them. Positions 022–023 and 062–063 stay open and aligned across sections.
Section A has an outer lane with bays A101–A112. Sections P–R extend right of N
at the full warehouse height and the same section width as B–N; each numbered position contains five separately
tracked sub-bays A–E (for example, P028A–P028E). The map displays the shared
parent label P028 without showing the final sub-bay letter. There are 1,635
inventory locations. Scroll horizontally to explore the whole floor.
Hover or focus a bay to read its full contents; click or tap it to keep the
contents visible below the map. Crowded bays show a hover hint.

`public/inventory.json` contains clearly labeled demo inventory retained as a
reference. The current UI is upload-only and does not fetch or poll this file.
The feed contract below describes the preserved demo format.
Each bay maps to an array of objects with a `model` string and a nonnegative
integer `quantity`. An empty array means an empty bay. Include all 1,635 storage location keys. Standard bay IDs use a section letter
and three digits; P–R sub-bays add a final letter A–E. Example entries:

```json
{
  "demo": true,
  "bays": {
    "A001": [{ "model": "WH-240", "quantity": 42 }],
    "A002": []
  }
}
```

If background feed loading is restored, its former configuration used `VITE_INVENTORY_URL` in `.env.local` to a JSON
endpoint with the same structure and set `demo` to false in its response.
Restart Vite after changing environment configuration. A remote endpoint must
allow browser requests from the app's origin. Do not put secrets in Vite
variables; they are exposed to the browser. Failed requests retain the last
valid inventory and display a connection warning.

Use **Fit to screen** in the floor toolbar to show all sections in one screen. This view hides in-bay inventory; hover, keyboard focus, or
 tap a bay for full details. **Exit fit view** restores the original bay sizes.
The fitted layout adjusts when the window is resized, with bay labels hidden
on small screens to keep the full floor visible.

Dock doors 1–48 run across the top, with positions 22–27 left blank.
The horizontal access aisle below the doors is four times the width of a
vertical forklift aisle, including in fit-to-screen view.

## Dock orders and source connections

Order rendering, order search, and tracing are temporarily suspended in the
current UI. The code remains in `src/orders.js`; the import and `setupOrders`
startup line in `src/main.js` are commented with restore instructions. The active
model search marks matching bays with a blue dot beside the bay label in every section, including P, Q, and R. Bay colors and brightness stay unchanged. Only fit, a single show/hide counts toggle, and upload
controls are shown, with fit view and count view enabled at startup. Model search matches
live inventory by case-insensitive partial model text, suggests models found in
inventory, and highlights matching bays. Order instructions below describe
preserved feature code; those controls are inactive until order startup is restored.

The demo includes two orders in front of every active dock. Hover over an order, or focus it with the keyboard, to highlight its source
bays and draw curved blue arrows from those bays to the order. Move the pointer away or move keyboard focus to hide
the connections; Escape also clears them. Fit view shows all sources at once.
These lines show order provenance, not a driving route through the aisles.

Orders refresh with inventory. Add an optional `orders` array to the inventory
response (omit it or use an empty array for no orders):

```json
"orders": [
  {
    "id": "SO-011",
    "dock": 1,
    "sources": [{ "bay": "A003" }, { "bay": "B012" }]
  }
]
```

Order IDs must be unique. Dock numbers must be 1–21 or 28–48, and each source
must name an existing bay. Multiple source records for one bay share one arrow.
Actual order provenance must come from your order/warehouse data source.

## Search models across orders

Order linked search and suggestions are suspended. Use the toolbar's **Find model in bays** field to filter directly against bay inventory.

Type part of a model number in the floor toolbar to see matching model
suggestions in alphabetical order. Select a model to show its matching orders
and source connections. Suggestions include models found in the order feed and
examples of real LG appliances. Matching is case-insensitive and accepts partial
text; a suggested model only shows orders when the feed contains matching data.
Each arrow is labeled with the source bay, model, and allocated quantity.
Expand the results summary to see each order, dock, source, and total quantity.
Hover over an order to isolate its matching connections; move away to restore all
search matches. Clear the search to return to the usual hover-only view.

The bundled demo has 250 distinct models across its order sources, including
four real LG appliance model numbers and 243 clearly labeled `DEMO-###` sample
models. These are distributed across uncounted bays and the demo orders.

For model searches, each order source record should include its allocation:

```json
{"bay": "A003", "model": "AX-560", "quantity": 7}
```

Quantities describe units supplied to that order, not the bay's current stock.
Repeated records for the same order, bay, and model are added together. Legacy
bay-only records still support hover-to-trace, but cannot match a model search.
Missing quantities are shown as unknown and are excluded from known-unit totals.
The demo includes explicit sample allocations; a real integration must provide
these fields from its order history. Active searches refresh with the data.

## Count comparison

Click **Show counts** to color counted bays green when every model matches the
system inventory and red when any model differs. Uncounted bays are yellow with
a dark gold border. A single show/hide counts button controls count colors.
Model search adds a blue dot to matching bays outside P, Q, and R while retaining their count colors.
Hover, focus, or select a bay for the system quantity, physical count, and shortage
or overage for each model. **Hide counts** restores normal inventory colors.
The toggle only changes the view; it does not mark bays as counted or change stock.

The inventory response may include a `counts` object with complete physical counts
for each counted bay, using the same item shape as `bays`:

```json
"counts": {
  "A001": [{ "model": "AX-560", "quantity": 7 }],
  "A002": []
}
```

An omitted bay is uncounted. An empty array means counted and physically empty.
Missing models within a counted bay have a physical quantity of zero; extra
models have a system quantity of zero. Repeated model entries are summed before
comparison. Differences are checked per model, so an overage cannot cancel a
shortage of a different model. Count updates refresh with inventory. Demo counts
are sample data; supply actual physical counts through your inventory source.

Before uploading a count file, bay interiors are white with labels and thin
outlines. Startup does not fetch or poll background inventory; there are no
model values or offset arrows until you upload. Uploading applies the file’s status colors.

**Legend & upload details** expands or collapses the color key, search summary,
count totals, and upload information. It starts collapsed and remembers your
choice. Upload errors open it automatically. Not Started bays have white interiors
and thin dark outlines, including in the fitted view.

Use **Upload counts** to load an Excel workbook (`.xlsx` or `.xls`) or CSV file.
The first worksheet supports the warehouse export's two header rows: `Status`,
`Location`, `Model`, `Count Qty` → `A - B`, `Task System Qty`, and `Task Diff Y/N`.
The single Task System Qty column takes precedence over the team subcolumns.

- **Not Started**: uncounted, with a visible dark outline, even if Task Diff says No.
- **Processing / Yes**: red. **Processing / No**: green. Confirmed rows use the same Yes/No rules.
- Task Diff controls the color even when the numeric quantities suggest something else.
- Missing expected bays: dark gray. The uploaded floor includes 101 then 001–032
  and 141 then 041–072, preserving the 022–023 and 062–063 crossing gaps.
- Lettered locations in any section split the parent footprint into vertical
  strips, one per distinct listed suffix. Missing suffixes are not invented or
  grayed out. Parent labels omit suffixes; tooltips show full location IDs.
- Any Yes row makes its location red. Otherwise Not Started takes precedence
  over No; partial or unknown rows remain incomplete.

Locations outside these map ranges (including crossing locations, HDONLY, and
OFFICECAGE) stay in model totals and appear in an expandable upload notice. They
have no map cells or arrow endpoints. Uploaded models supply map search and bay
information. Uploads last for the current session; refreshing restores the feed.

The older flat `Count Qty A-B` sample format still works. Without a Task Diff
column, quantities are compared after summing duplicate model/location rows.
Miscount totals and possible offset arrows always use numeric quantities;
Not Started rows contribute no physical count, even if a placeholder number is present.

An upload-ready sample is available at
[`public/samples/lg-200-model-counts.xlsx`](public/samples/lg-200-model-counts.xlsx)
(served as `samples/lg-200-model-counts.xlsx`). It distributes 200 distinct LG
appliance models across 1,635 locations: 1,461 matching, 34 discrepant, one
partial bay, and 139 uncounted. It includes P–R sub-bays A–E.
Quantities and assignments are synthetic. The workbook includes official LG
product links, including older models, and instructions. Uploading changes count
colors and map model information; preserved order data still comes from the JSON feed.
Regenerate it with `node scripts/generate-lg-count-sample.mjs` using the checked-in
`public/samples/lg-model-sources.json` model list.

## Access over VPN

`npm run dev` listens on all IPv4 interfaces at port **5174**, including the
Tailscale interface. From another device connected to the same tailnet, open
`http://100.115.64.48:5174/` (this machine's current Tailscale address).
Local access remains `http://localhost:5174/`. Vite live updates use the same
address and port. Start without a `--host 127.0.0.1` override, which restricts
access to this machine. The fixed port avoids silently switching URLs.

The peer must be allowed to reach TCP 5174 by your Tailscale access rules and
host firewall. No router port forwarding is needed. The server also listens
on LAN interfaces. `npm run preview` uses the same network binding on port 4173.

Model-search results show five orders per page. Entering a search opens the
results summary; use **Previous** / **Next** to browse, with the current page
and order range shown between the controls. A new search starts on page one.
Live updates keep the current page when possible, or move to the last available
page if results shrink. The map continues to show connections for all matching
orders.

Enable **Trace bay orders** and click a bay to draw arrows from that bay to each
order that lists it as a source. The selected bay and matching orders stay
highlighted until another bay is selected or tracing is turned off. Order hover
still previews an individual order. Bay tracing also respects the current model
search, so searching first shows only orders sourcing the selected model.

**Trace off counts** highlights all bays whose physical count differs from
system inventory and draws arrows from each affected bay/model to orders that
include that same source model. The selected discrepancies and related order
IDs appear in the trace summary. This view updates when counts or orders refresh
and works alongside model search.

## Remembered selections

A first visit opens in fit-to-screen mode. The browser remembers your selected
bay and model search. In the current limited mode, startup always opens fit view
with counts shown. Other saved preferences remain browser and origin specific.

## Activity heatmap

Activity heatmap controls and processing are temporarily suspended in the
current UI. The instructions below document the preserved feature behavior.

Enable **Activity heatmap** to color bays by their latest recorded event:
red/orange for the last 15 minutes, orange within an hour, yellow within four
hours, blue within 24 hours, and neutral for older or missing activity. Hover,
focus, or tap a bay for its latest event, timestamp, model/quantity when supplied,
and event count over the last 24 hours. The heatmap measures recency, not stock
quantity or event volume. The setting is remembered. Count colors and heatmap
colors are mutually exclusive; tracing overlays remain available.

Add an optional `activity` array to the inventory response:

```json
"activity": [
  { "bay": "A001", "type": "Pick", "at": "2026-09-27T12:30:00Z", "model": "MX-108", "quantity": 3 }
]
```

Use existing bay IDs and ISO timestamps with a timezone. `model` and `quantity`
are optional; quantities must be nonnegative integers. Activity refreshes with
the feed, and live recency colors age every 30 seconds even without new records.
Future events do not count until their timestamp is reached. Omitted activity
means no recorded events; activity is not inferred from order or inventory data.

The bundled demo uses `demo: true` with an `activityAsOf` timestamp, so its heatmap
is a clearly labeled snapshot. Hover ages are relative to that snapshot. Real
feeds (`demo: false`) always use the current browser time and ignore this demo
reference timestamp.

**Trace off bays in recent orders** highlights bays with physical discrepancies
that supplied matching models to orders created in the last 24 hours. Arrows
connect each affected bay/model to the orders; model search narrows the traces.
Orders need a timezone-qualified `createdAt` timestamp for this view. Undated
orders remain visible and traceable through the other order tools.

The **Miscount models** button opens a list grouped into **Totals match system**
and **Totals differ or are incomplete**. Models qualify when their summed count
at a location differs from that location's system quantity; duplicate rows for
the same model and location are combined first. Each row shows system and counted
totals, the signed difference (counted minus system), and miscount locations.
Totals include all locations in the active source, including matching locations.
Uploads use the file's Count Qty A-B and Task System Qty rather than feed stock;
without an upload, the inventory/count feed is used. Blank counts and partial
rows make a model incomplete, so it cannot be classified as balanced. Uploaded
totals cover only locations listed in that file. The list is independent of map
search and count-color visibility.


Miscount arrows (`src/offset-pairs.js`) show possible exact offsets
for the same model at any two locations, regardless of distance. Purple arrows point from extra to
short; no inventory or physical counts are corrected automatically. Candidates
require both endpoints to have red (`off`) upload status, complete counts at both
endpoints, and equal, opposite differences after
summing duplicate rows. All candidates are shown if a bay has multiple possible
matches. Pair matching has no adjacency or distance restriction. P–R suffix locations remain distinct.
Arrows start hidden on each page load. **Show balance arrows** toggles them on;
once enabled they remain independent of count visibility and model search. Arrow
lines display the exchange quantity at their midpoint. Arrow
tips target the actual suffix bay centers using SVG screen-coordinate conversion
and follow resizing, fit changes, and re-uploaded geometry. Bay
details (even with counts hidden) and the miscount dialog describe the model, quantity, and endpoints.
Both the live demo and generated workbook include B005 → B006 (vertical, 4 units)
and D010 → D050 (horizontal, 3 units), plus B008 → M055 (distant, 5 units). Live demo still has 15 discrepant bays;
the workbook now has 34. Re-upload the regenerated workbook to replace a previous
session upload.

## Startup bay display

Startup uses the same 33-position layout in all sections, including P, Q, and R,
without forced A–E subdivisions. Uploaded suffixes remain distinct clickable bays
in every section; no section is excluded from model search indicators.
At page load, the bays briefly spell “LG” in red, then fade back to white over 650 ms (2.2 seconds total). Reduced-motion
preferences skip the fade. This startup display runs only once per page load; uploads
cancel it immediately, and controls, resizing, or re-uploading never restart it.
Balance arrows always start off and are controlled by **Show balance arrows**.
The legacy demo layout and data descriptions above refer to inactive reference assets.

Miscount-model membership respects each uploaded model row's Task Diff flag:
only Yes qualifies; No, missing flags, and Not Started rows do not. A different
model making the same bay red does not qualify correctly counted models there.
Legacy uploads without flags compare summed model/location quantities. Numeric
model totals still include every current-file location, and duplicate Yes flags
win within a model/location. Re-upload replaces the source rows and dialog contents.

The active forklift crossings are 022–023 / 062–063 in A–E and
025–026 / 065–066 from F through R. `src/layout.js` supplies the same crossing
rule to the renderer and upload parser. Restored F–R 022/023/062/063 bays include
all uploaded suffixes, search indicators, count colors, and arrow endpoints.
All other supported storage positions remain mapped; rows referring to permanent
lane positions or locations outside the floor remain in totals and the outside-map notice.

Main columns use shared upper/crossing/lower height bands so the forklift lane
runs straight through A–R despite different crossing numbers. Bays distribute
within each band without renumbering or omitting locations; the rule applies in
both detailed and fitted views. `.bay-zone` holds each band's bay cells.

The LG mosaic starts in section F so both letters use the same bay heights after
lane alignment. **Re-upload last file** reloads the latest successful upload
without a picker, and is disabled before the first upload. Where the browser
supports `showOpenFilePicker`, retain its handle for fresh disk reads. Other
browsers reload the uploaded copy (button tooltip explains that disk edits need
**Upload counts**). This source is session-only; failed uploads retain it, and
re-upload does not replay the startup logo.
