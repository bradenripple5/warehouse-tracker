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

The map repeats 13 sections horizontally: A–H and J–N (skipping I).
Each section has two vertical columns, numbered from top to bottom:
101, then 001–021, a crossing, then 024–030 on the left;
141, then 041–061, a crossing,
then 064–070 on the right. The two columns have a forklift aisle between them.
Positions 022–023 and 062–063 stay open, aligned across all sections.
There are 58 bays per section and 754 total. Scroll horizontally to explore the whole floor.
Hover or focus a bay to read its full contents; click or tap it to keep the
contents visible below the map. Crowded bays show a hover hint.

`public/inventory.json` contains clearly labeled demo inventory. The app polls
it every five seconds, so changes to that file appear without manually reloading.
Each bay maps to an array of objects with a `model` string and a nonnegative
integer `quantity`. An empty array means an empty bay. Include all 754 storage
bay keys, formatted with a section letter prefix and three digits. Example entries:

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

Enter a model in the floor toolbar to show every matching order and its source
connections. Search is case-insensitive and matches part of the model number.
Each arrow is labeled with the source bay, model, and allocated quantity.
Expand the results summary to see each order, dock, source, and total quantity.
Hover over an order to isolate its matching connections; move away to restore all
search matches. Clear the search to return to the usual hover-only view.

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
system inventory and red when any model differs. Uncounted bays remain neutral.
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

Model-search results show five orders per page. Expand the results summary and
use **Previous** / **Next** to browse, with the current page and order range
shown between the controls. A new search starts on page one. Live updates keep
the current page when possible, or move to the last available page if results
shrink. The map continues to show connections for all matching orders.

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

A first visit opens in fit-to-screen mode. The browser remembers your last
layout, count display, selected bay, tracing mode, model search, search page,
and whether search results are expanded. Selections are saved in localStorage
and restored on the next visit; hovered orders are temporary. Invalid or blocked
storage falls back to usable defaults. Preferences belong to the browser and
site address, so localhost and the VPN address keep separate selections.

## Activity heatmap

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
