import './style.css';
// TEMPORARILY SUSPENDED: uncomment setupOrders and its startup call below to
// restore order stacks, order-linked search, source arrows, and all trace modes.
// setupOrders adds its own search field; remove the bay-only field above if
// restoring that search to avoid showing duplicate model search controls.
// import { setupOrders } from './orders.js';
import { summarizeMiscounts } from './miscounts.js';
import { findOffsetPairs, setupOffsetArrows } from './offset-pairs.js';
let uploadedModelRows = null;
import { getPreferences, savePreferences } from './preferences.js';
// TEMPORARILY SUSPENDED: activity heatmap controls and recency rendering.
// Restore the activity.js import and refresh/render hooks to re-enable it.
import * as XLSX from 'xlsx';
import { parseCountUpload } from './upload-counts.js';
let uploadedFlagged = false;

const sections = [...'ABCDEFGHJKLMNPQR'];
const bayId = (letter, n) => `${letter}${String(n).padStart(3, '0')}`;
const preferences = getPreferences();
let uploadedCounts = null, uploadedBayStates = new Map(), selected = preferences.selectedBay;
let showCounts = true;
let modelSearch = preferences.modelSearch;
let tooltipBay = null;
document.querySelector('main').outerHTML = `
<header><a href="./" class="brand"><b>▥</b> WAREHOUSE <span>/ OPERATIONS</span></a><span id="status" role="status">No data · upload counts</span></header>
<main>
<section class="heading"><div><div class="eyebrow">INVENTORY OVERVIEW</div><h1>A place for everything.</h1><p>Your floor, bay by bay. Hover or select a bay to inspect its inventory.</p></div><div class="updated">LAST UPLOAD<span id="updated">—</span></div></section>
<section class="metrics"><div><label>STORAGE BAYS</label><strong>1635 <small>across 16 sections</small></strong></div><div><label>OCCUPIED</label><strong id="occupied">—</strong></div><div><label>TOTAL UNITS</label><strong id="units">—</strong></div><div><label>AVAILABLE BAYS</label><strong id="available">—</strong></div></section>
<section class="floor-panel"><div class="floor-heading"><div><h2>Warehouse floor</h2><span>TOP VIEW · SECTIONS A–R · NO I/O</span></div><div class="floor-tools"><button type="button" id="fit-toggle" aria-pressed="false" aria-controls="sections">Fit to screen</button><button type="button" id="counts-toggle" aria-pressed="false" aria-controls="sections">Show counts</button><button type="button" id="miscount-models" aria-haspopup="dialog">Miscount models</button><button type="button" id="upload-counts">Upload counts</button><input id="counts-file" type="file" accept=".xlsx,.xls,.csv" hidden><details id="map-legend"><summary>Legend &amp; upload details</summary><div class="map-legend-content"><span id="model-search-summary" role="status" hidden></span><div class="legend inventory-legend"><span><i></i>Stocked</span><span><i class="empty-key"></i>Empty</span><span><i class="aisle-key"></i>Forklift access</span></div><div class="legend count-legend" hidden><span><i class="match-key"></i>Count matches</span><span><i class="off-key"></i>Count differs</span><span><i class="upload-not-started-key"></i>Not Started</span><span><i class="upload-absent-key"></i>Not listed</span><span><i class="empty-key"></i>Uncounted</span></div><span id="count-summary" role="status" hidden></span><span id="upload-message" role="status" hidden></span></div></details></div></div>
<div class="map-scroll"><div class="floor"><div class="dock-doors" aria-label="Dock doors 1–48; positions 22–27 are blank"></div><div class="dock-aisle" aria-label="Horizontal forklift aisle"><span>←</span><span>DOCK ACCESS · FORKLIFT AISLE</span><span>→</span></div><div class="warehouse-sections" id="sections"></div></div></div>
<footer><span>Warehouse map · sections A–R, skipping I and O</span><span id="offset-summary"></span><span id="map-hint">Scroll horizontally to explore sections A–R ↔</span></footer></section>
<aside id="details" aria-live="polite">Select a bay to keep its inventory visible here.</aside></main><div id="tooltip" role="tooltip" hidden></div>
<dialog id="miscount-dialog" aria-labelledby="miscount-title"><form method="dialog"><button aria-label="Close miscount models">Close</button></form><h2 id="miscount-title">Models with miscounts</h2><p id="miscount-scope"></p><div id="miscount-lists"></div></dialog>`;
const mapLegend = document.querySelector('#map-legend');
mapLegend.open = preferences.legendExpanded;
mapLegend.addEventListener('toggle', () => savePreferences({ legendExpanded: mapLegend.open }));
applyFitView(true);
savePreferences({ fitView: true, showCounts: true, showActivity: false });
const dockDoors = document.querySelector('.dock-doors');
for (let number = 48; number >= 1; number--) {
  const door = document.createElement('div');
  if (number >= 22 && number <= 27) {
    door.className = 'dock-door-blank';
    door.setAttribute('aria-hidden', 'true');
  } else {
    door.className = 'dock-door';
    door.dataset.door = number;
    door.textContent = number;
    door.setAttribute('aria-label', `Dock door ${number}`);
  }
  dockDoors.append(door);
}
function createBay(row, letter, n, subBay = '') {
  const button = document.createElement('button');
  button.className = subBay ? 'bay bay-subcell' : 'bay';
  button.dataset.bay = `${bayId(letter, n)}${subBay}`;
  button.dataset.baseBay = bayId(letter, n);
  button.innerHTML = `<span class="bay-number">${bayId(letter, n)}</span><span class="bay-items"></span><span class="bay-marker"></span><span class="model-match-dot" aria-hidden="true"></span>`;
  button.addEventListener('mouseenter', () => showTooltip(button));
  button.addEventListener('mouseleave', hideTooltip);
  button.addEventListener('focus', () => showTooltip(button));
  button.addEventListener('blur', hideTooltip);
  button.addEventListener('click', () => { selected = button.dataset.bay; savePreferences({ selectedBay: selected }); renderSelection(); if (document.body.classList.contains('fit-view')) showTooltip(button); });
  row.append(button);
}
function createCompositeBay(row, letter, n, suffixes = [...'ABCDE']) {
  const group = document.createElement('div');
  group.className = 'pqr-bay-row'; group.dataset.baseBay = bayId(letter, n);
  group.style.setProperty('--sub-bays', suffixes.length);
  for (const subBay of suffixes) createBay(group, letter, n, subBay);
  row.append(group);
}
function createColumn(row, letter, first, last, subdivisions = null) {
  for (let position = -1; position <= last - first; position++) {
    const n = position === -1 ? first + 100 : first + position;
    if (n === 22 || n === 62) {
      const gap = document.createElement('div');
      gap.className = 'crossing'; gap.style.gridRow = 'span 2';
      gap.innerHTML = '<span>↔</span>';
      gap.setAttribute('aria-label', 'Forklift crossing');
      row.append(gap); position += 1; continue;
    }
    if (letter === 'A' && first === 1 && n === 101) {
      const space = document.createElement('div'); space.className = 'bay-space'; space.setAttribute('aria-hidden', 'true'); row.append(space);
    } else if (subdivisions) {
      const suffixes = [...(subdivisions.get(bayId(letter, n)) ?? [''])].sort();
      if (suffixes[0]) createCompositeBay(row, letter, n, suffixes);
      else createBay(row, letter, n);
    } else if ('PQR'.includes(letter)) createCompositeBay(row, letter, n);
    else createBay(row, letter, n);
  }
}
function renderMap(subdivisions = null) {
  const container = document.querySelector('#sections');
  container.replaceChildren();
  container.style.setProperty('--bay-rows', subdivisions ? 33 : 31);
  for (const letter of sections) {
    const section = document.createElement('section');
    section.className = 'storage-section';
    section.setAttribute('aria-label', `Section ${letter}`);
    const specialLayout = `${letter === 'A' ? ' with-a-side' : ''}${'PQR'.includes(letter) ? ' with-sub-bays' : ''}`;
    section.innerHTML = `<h3>SECTION <b>${letter}</b></h3><div class="section-layout${specialLayout}">${letter === 'A' ? '<div class="bay-column a-side-column" aria-label="A-side bays 101–112"></div>' : ''}<div class="bay-column left-column"></div><div class="vertical-aisle" aria-label="Forklift aisle for section ${letter}"><span>↕</span><span>FORKLIFT AISLE</span><span>↕</span></div><div class="bay-column right-column"></div></div>`;
    document.querySelector('#sections').append(section);
    if (letter === 'A') for (let number = 101; number <= 112; number++) {
      const suffixes = [...(subdivisions?.get(bayId(letter, number)) ?? [''])].sort();
      if (suffixes[0]) createCompositeBay(section.querySelector('.a-side-column'), letter, number, suffixes);
      else createBay(section.querySelector('.a-side-column'), letter, number);
    }
    createColumn(section.querySelector('.left-column'), letter, 1, subdivisions ? 32 : 30, subdivisions);
    createColumn(section.querySelector('.right-column'), letter, 41, subdivisions ? 72 : 70, subdivisions);
  }
}
renderMap();
// Keep the dock access aisle exactly four times the vertical aisle width,
// including when fit view changes the column widths or the window is resized.
const floor = document.querySelector('.floor');
let aisleResizeFrame;
const aisleObserver = new ResizeObserver(([entry]) => {
  const width = `${entry.contentRect.width}px`;
  if (floor.style.getPropertyValue('--vertical-aisle-width') === width) return;
  cancelAnimationFrame(aisleResizeFrame);
  aisleResizeFrame = requestAnimationFrame(() => {
    floor.style.setProperty('--vertical-aisle-width', width);
  });
});
aisleObserver.observe(document.querySelector('.vertical-aisle'));
const buttons = [...document.querySelectorAll('.bay')];
const updateOffsetArrows = setupOffsetArrows(floor, buttons);
let offsetPairs = [];
function activeCountRows() { return uploadedModelRows ?? []; }
// const updateOrders = setupOrders(floor); // Restore with the import above to re-enable orders/tracing.
const modelSearchInput = document.createElement('input');
modelSearchInput.type = 'search'; modelSearchInput.id = 'inventory-model-search';
modelSearchInput.className = 'model-search-input';
modelSearchInput.setAttribute('aria-label', 'Find model in warehouse bays');
modelSearchInput.setAttribute('list', 'inventory-model-options');
modelSearchInput.placeholder = 'Find model in bays'; modelSearchInput.value = modelSearch;
const modelOptions = document.createElement('datalist'); modelOptions.id = 'inventory-model-options';
document.querySelector('.floor-tools').prepend(modelOptions, modelSearchInput);
modelSearchInput.addEventListener('input', () => {
  modelSearch = modelSearchInput.value;
  savePreferences({ modelSearch });
  renderCounts();
});
const countsToggle = document.querySelector('#counts-toggle');
const countsFile = document.querySelector('#counts-file');
document.querySelector('#upload-counts').addEventListener('click', () => countsFile.click());
countsFile.addEventListener('change', async () => {
  const file = countsFile.files?.[0];
  if (!file) return;
  const message = document.querySelector('#upload-message');
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    const parsed = parseCountUpload(grid);
    uploadedModelRows = parsed.modelRows;
    uploadedCounts = Object.fromEntries([...parsed.states].filter(([, state]) => ['match', 'off', 'partial'].includes(state)).map(([id]) => [id, []]));
    uploadedBayStates = parsed.states;
    uploadedFlagged = parsed.flagged;
    hideTooltip();
    aisleObserver.disconnect();
    renderMap(parsed.subdivisions);
    buttons.splice(0, buttons.length, ...document.querySelectorAll('.bay'));
    aisleObserver.observe(document.querySelector('.vertical-aisle'));
    if (selected && !buttons.some(button => button.dataset.bay === selected)) {
      selected = null; savePreferences({ selectedBay: null });
      document.querySelector('#details').textContent = 'Select a bay to inspect its uploaded counts.';
    }
    renderInventory();
    showCounts = true;
    savePreferences({ showCounts, showActivity: false }); applyCountView(); hideTooltip(); renderCounts(); renderSelection();
    document.querySelector('#updated').textContent = new Date().toLocaleTimeString();
    document.querySelector('#status').textContent = 'Uploaded counts · current session';
    document.querySelector('#status').classList.remove('error');
    message.hidden = false; message.textContent = `Loaded ${parsed.states.size} locations from ${file.name}. ${parsed.outside.length} locations outside the floor map retained in model totals.`;
    let outsideDetails = document.querySelector('#outside-locations');
    if (!outsideDetails) {
      outsideDetails = document.createElement('details'); outsideDetails.id = 'outside-locations';
      message.after(outsideDetails);
    }
    outsideDetails.replaceChildren(); outsideDetails.hidden = !parsed.outside.length;
    const summary = document.createElement('summary'); summary.textContent = 'Locations outside the floor map';
    const list = document.createElement('span'); list.textContent = parsed.outside.join(', ');
    outsideDetails.append(summary, list);
  } catch (error) {
    mapLegend.open = true;
    message.hidden = false; message.textContent = `Upload failed: ${error.message}`;
  } finally { countsFile.value = ''; }
});
// TEMPORARILY SUSPENDED: activity heatmap toggle and controls. Re-enable the
// activity.js import, toolbar markup, and refresh/render hooks to restore it.
countsToggle.addEventListener('click', () => {
  showCounts = !showCounts;
  savePreferences({ showCounts, showActivity: false });
  applyCountView();
  hideTooltip(); renderCounts(); renderSelection();
});
function applyCountView() {
  document.body.classList.toggle('no-upload', uploadedCounts === null);
  document.querySelector('.count-legend').innerHTML = (uploadedCounts ? '<span><i class="match-key"></i>Task Diff No</span><span><i class="off-key"></i>Task Diff Yes</span><span><i class="upload-not-started-key"></i>Not Started</span><span><i class="upload-absent-key"></i>Not listed</span><span><i class="partial-key"></i>Partial / unknown</span>' : '<span><i class="empty-key"></i>No data loaded</span>');
  countsToggle.setAttribute('aria-pressed', String(showCounts));
  countsToggle.textContent = showCounts ? 'Hide counts' : 'Show counts';
  document.body.classList.toggle('counts-view', showCounts);
  document.querySelector('.inventory-legend').hidden = showCounts || !uploadedCounts;
  document.querySelector('.count-legend').hidden = !showCounts;
  document.querySelector('#count-summary').hidden = !showCounts;
}
applyCountView();
const miscountDialog = document.querySelector('#miscount-dialog');
document.querySelector('#miscount-models').addEventListener('click', () => {
  renderMiscountModels();
  miscountDialog.showModal();
});
function renderMiscountModels() {
  const models = summarizeMiscounts(activeCountRows());
  const offsets = findOffsetPairs(activeCountRows());
  document.querySelector('#miscount-scope').textContent = `${uploadedModelRows ? 'Uploaded file: totals include all listed locations, using Count Qty A-B and Task System Qty.' : 'No data loaded. Upload a count file to see model totals.'} Only models with a location discrepancy are listed. Missing or partial counts are incomplete; their difference is provisional. This list includes all models regardless of map search.`;
  const lists = document.querySelector('#miscount-lists');
  lists.replaceChildren();
  for (const balanced of [true, false]) {
    const group = models.filter(model => model.balanced === balanced);
    const section = document.createElement('section');
    const title = document.createElement('h3');
    title.textContent = `${balanced ? 'Totals match system' : 'Totals differ or are incomplete'} (${group.length})`;
    section.append(title);
    if (!group.length) {
      const empty = document.createElement('p'); empty.textContent = 'No models in this group.'; section.append(empty);
    } else {
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th scope="col">Model / miscount locations</th><th scope="col">System</th><th scope="col">Counted</th><th scope="col">Difference</th></tr></thead>';
      const body = document.createElement('tbody');
      for (const item of group) {
        const row = document.createElement('tr');
        const delta = item.counted - item.system;
        const label = document.createElement('th'); label.scope = 'row'; label.textContent = item.model;
        const bays = document.createElement('small'); bays.textContent = item.offBays.join(', '); label.append(bays); row.append(label);
        for (const pair of offsets.filter(pair => pair.model === item.model)) {
          const note = document.createElement('small');
          note.textContent = `Possible offset: ${pair.from} → ${pair.to} · ${pair.quantity} units (extra → short)`; label.append(note);
        }
        for (const value of [item.system.toLocaleString(), `${item.counted.toLocaleString()}${item.incomplete ? ' (incomplete)' : ''}`, `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`]) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        body.append(row);
      }
      table.append(body); section.append(table);
    }
    lists.append(section);
  }
}
function uploadStateText(state) {
  return state === 'match' ? (uploadedFlagged ? 'Task Diff: No · count good' : 'Count matches system') :
    state === 'off' ? (uploadedFlagged ? 'Task Diff: Yes · count off' : 'Count differs from system') :
    state === 'not-started' ? 'Not Started · not counted' : state === 'absent' ? 'Not listed in uploaded file' :
    state === 'partial' ? 'Partial completion' : 'Count status unknown';
}
function bayItems(id) {
  if (!uploadedModelRows) return [];
  return uploadedModelRows.filter(row => row.bay === id && row.model).map(row => ({ model: row.model, quantity: row.system }));
}
function renderInventory() {
  let occupied = 0, units = 0;
  for (const button of buttons) {
    const items = bayItems(button.dataset.bay);
    occupied += items.length ? 1 : 0;
    button.classList.toggle('empty', !items.length);
    const list = button.querySelector('.bay-items'); list.replaceChildren();
    for (const item of items) {
      units += item.quantity;
      const line = document.createElement('span'); line.textContent = `${item.model}: ${item.quantity}`; list.append(line);
    }
    if (!items.length) list.textContent = '—';
  }
  document.querySelector('.metrics strong').innerHTML = `${buttons.length} <small>across 16 sections</small>`;
  document.querySelector('#occupied').textContent = occupied;
  document.querySelector('#available').textContent = buttons.length - occupied;
  document.querySelector('#units').textContent = units.toLocaleString();
  const models = [...new Set(uploadedModelRows ? uploadedModelRows.map(row => row.model).filter(Boolean) : [])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  modelOptions.replaceChildren(...models.map(model => { const option = document.createElement('option'); option.value = model; return option; }));
  fitText();
}
function renderCounts() {
  offsetPairs = findOffsetPairs(activeCountRows());
  updateOffsetArrows(offsetPairs);
  const visibleIds = new Set(buttons.map(button => button.dataset.bay));
  const visiblePairs = offsetPairs.filter(pair => visibleIds.has(pair.from) && visibleIds.has(pair.to));
  document.querySelector('#offset-summary').textContent = uploadedCounts ? `↗ ${visiblePairs.length} possible offset pairs on map · purple arrows: extra → short` : '';
  if (miscountDialog.open) renderMiscountModels();
  let matched = 0, off = 0, matchingBays = 0;
  const searchText = modelSearch.trim().toLocaleLowerCase();
  for (const button of buttons) {
    const id = button.dataset.bay;
    const uploadedState = uploadedCounts ? (uploadedBayStates.get(id) ?? 'absent') : null;
    const comparison = uploadedCounts
      ? { status: uploadedState ?? 'uncounted', lines: [uploadStateText(uploadedState)] }
      : { status: 'no-data', lines: ['No data loaded · upload a count file'] };
    button.dataset.countStatus = comparison.status;
    button.dataset.uploadState = uploadedCounts ? uploadedState : '';
    matched += comparison.status === 'match' ? 1 : 0;
    off += comparison.status === 'off' ? 1 : 0;
    const items = bayItems(id);
    const modelMatch = Boolean(searchText) && items.some(item => item.model.toLocaleLowerCase().includes(searchText));
    button.dataset.modelMatch = String(modelMatch);
    if (modelMatch) matchingBays++;
    button.setAttribute('aria-label', `Bay ${id}: ${showCounts ? comparison.lines.join('; ') : items.length ? items.map(i => `${i.model}: ${i.quantity}`).join(', ') : 'Empty'}`);
  }
  document.querySelectorAll('.pqr-bay-row').forEach(group => {
    const members = buttons.filter(button => button.dataset.baseBay === group.dataset.baseBay);
    const statuses = members.map(button => button.dataset.countStatus);
    const counted = statuses.filter(status => ['match', 'off', 'partial'].includes(status)).length;
    group.classList.toggle('partial-completion', statuses.includes('partial') || (!uploadedCounts && counted > 0 && counted < members.length));
  });
  const loaded = uploadedCounts ? `${matched} good · ${off} off · ${buttons.filter(b => b.dataset.countStatus === 'not-started').length} Not Started · ${buttons.filter(b => b.dataset.countStatus === 'absent').length} not listed` : 'No data loaded · upload a count file';
  document.querySelector('#count-summary').textContent = loaded;
  const searchSummary = document.querySelector('#model-search-summary');
  searchSummary.hidden = !modelSearch.trim();
  searchSummary.textContent = modelSearch.trim() ? `${matchingBays} bays contain a matching model` : '';
}
const fitToggle = document.querySelector('#fit-toggle');
fitToggle.addEventListener('click', () => {
  const fitted = !document.body.classList.contains('fit-view');
  applyFitView(fitted);
  savePreferences({ fitView: fitted });
  document.querySelector('.map-scroll').scrollLeft = 0;
  hideTooltip();
  if (!fitted) fitText();
});
function applyFitView(fitted) {
  document.body.classList.toggle('fit-view', fitted);
  const toggle = document.querySelector('#fit-toggle');
  toggle.setAttribute('aria-pressed', String(fitted));
  toggle.textContent = fitted ? 'Exit fit view' : 'Fit to screen';
  document.querySelector('#map-hint').textContent = fitted
    ? 'Hover, focus, or tap a bay for inventory'
    : 'Scroll horizontally to explore sections A–R ↔';
}
function fillDetails(element, id) {
  element.replaceChildren();
  const title = document.createElement('strong'); title.textContent = `Bay ${id}`; element.append(title);
  if (!uploadedCounts) {
    const line = document.createElement('span'); line.textContent = 'No data loaded · upload a count file'; element.append(line);
    return;
  }
  const items = bayItems(id);
  for (const pair of offsetPairs.filter(pair => pair.from === id || pair.to === id)) {
    const line = document.createElement('span');
    line.textContent = `Possible offset: ${pair.model} · ${pair.quantity} units · ${pair.from} (extra) → ${pair.to} (short)`;
    element.append(line);
  }
  if (showCounts) {
    const uploadedState = uploadedCounts ? (uploadedBayStates.get(id) ?? 'absent') : null;
    const countLines = uploadedCounts
      ? [uploadStateText(uploadedState)]
      : ['No data loaded · upload a count file'];
    for (const text of countLines) {
      const line = document.createElement('span'); line.textContent = text; element.append(line);
    }
    if (uploadedModelRows) for (const row of uploadedModelRows.filter(row => row.bay === id)) {
      const line = document.createElement('span');
      line.textContent = `${row.model || 'No model'} · system ${row.system} · counted ${row.counted ?? 'not counted'}`;
      element.append(line);
    }
    return;
  }
  for (const text of items.length ? items.map(i => `${i.model}: ${i.quantity.toLocaleString()}`) : ['Empty · available for storage']) {
    const line = document.createElement('span'); line.textContent = text; element.append(line);
  }
}
function renderSelection() {
  buttons.forEach(b => b.classList.toggle('selected', b.dataset.bay === selected));
  if (selected) fillDetails(document.querySelector('#details'), selected);
}
function showTooltip(button) {
  tooltipBay = button;
  const tip = document.querySelector('#tooltip'); fillDetails(tip, button.dataset.bay); tip.hidden = false;
  const rect = button.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - tip.offsetWidth - 12))}px`;
  tip.style.top = `${Math.max(12, Math.min(rect.bottom + 8, innerHeight - tip.offsetHeight - 12))}px`;
}
function hideTooltip() { document.querySelector('#tooltip').hidden = true; tooltipBay = null; }
window.addEventListener('scroll', hideTooltip, true);
window.addEventListener('resize', () => { hideTooltip(); fitText(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTooltip(); });
function fitText() {
  if (document.body.classList.contains('fit-view')) return;
  document.querySelectorAll('.bay-items').forEach(list => {
    let size = 11; list.style.fontSize = `${size}px`;
    while (size > 6 && (list.scrollHeight > list.clientHeight || list.scrollWidth > list.clientWidth)) list.style.fontSize = `${--size}px`;
    list.closest('.bay').classList.toggle('dense', size < 9);
  });
}
// Startup is upload-only: never fetch or poll the bundled demo inventory.
renderCounts();
renderSelection();
