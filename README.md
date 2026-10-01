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

`public/inventory.json` contains clearly labeled demo inventory. The app polls
it every five seconds, so changes to that file appear without manually reloading.
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

To connect a real source, set `VITE_INVENTORY_URL` in `.env.local` to a JSON
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
model search marks matching bays with a blue dot beside the bay label, excluding
sections P, Q, and R. Bay colors and brightness stay unchanged. Only fit, a single show/hide counts toggle, and upload
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

Use **Upload counts** to load an Excel workbook (`.xlsx` or `.xls`) or CSV file.
The worksheet needs `Location`, `Count Qty` → `A-B`, and `Task System Qty`
columns. When system quantity is split into `A Team` and `B Team` subcolumns,
the importer adds them together. A counted bay is green when its A-B quantity
matches the system quantity, red when any row differs, and yellow when the
`Status` field says `Partial`. Bays without an A-B count remain uncounted. In P–R,
base locations are split into lettered A–E sub-bays. The upload replaces feed counts for the current session
and is not saved after reloading.

An upload-ready sample is available at
[`public/samples/lg-200-model-counts.xlsx`](public/samples/lg-200-model-counts.xlsx)
(served as `samples/lg-200-model-counts.xlsx`). It distributes 200 distinct LG
appliance models across 1,635 locations: 1,461 matching, 34 discrepant, one
partial bay, and 139 uncounted. It includes P–R sub-bays A–E.
Quantities and assignments are synthetic. The workbook includes official LG
product links, including older models, and instructions. Uploading changes count
colors; inventory model labels and orders continue to come from the JSON feed.
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
require complete counts at both endpoints and equal, opposite differences after
summing duplicate rows. All candidates are shown if a bay has multiple possible
matches. Pair matching has no adjacency or distance restriction. P–R suffix locations remain distinct.
Arrows stay visible regardless of count visibility or model search and resize with the floor. Bay
details (even with counts hidden) and the miscount dialog describe the model, quantity, and endpoints.
Both the live demo and generated workbook include B005 → B006 (vertical, 4 units)
and D010 → D050 (horizontal, 3 units), plus B008 → M055 (distant, 5 units). Live demo still has 15 discrepant bays;
the workbook now has 34. Re-upload the regenerated workbook to replace a previous
session upload.
