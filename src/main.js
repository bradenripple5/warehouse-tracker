import './style.css';
// TEMPORARILY SUSPENDED: uncomment setupOrders and its startup call below to
// restore order stacks, order-linked search, source arrows, and all trace modes.
// setupOrders adds its own search field; remove the bay-only field above if
// restoring that search to avoid showing duplicate model search controls.
// import { setupOrders } from './orders.js';
import { compareCount, validateCounts } from './counts.js';
import { getPreferences, savePreferences } from './preferences.js';
// TEMPORARILY SUSPENDED: activity heatmap controls and recency rendering.
// Restore the activity.js import and refresh/render hooks to re-enable it.
import * as XLSX from 'xlsx';

const sections = [...'ABCDEFGHJKLMNPQR'];
const bayId = (letter, n) => `${letter}${String(n).padStart(3, '0')}`;
const preferences = getPreferences();
let inventory = {}, counts = {}, uploadedCounts = null, uploadedBayStates = new Map(), selected = preferences.selectedBay, lastPayload = '';
let showCounts = true;
let modelSearch = preferences.modelSearch;
let tooltipBay = null;
document.querySelector('main').outerHTML = `
<header><a href="./" class="brand"><b>▥</b> WAREHOUSE <span>/ OPERATIONS</span></a><span id="status" role="status">Connecting…</span></header>
<main>
<section class="heading"><div><div class="eyebrow">INVENTORY OVERVIEW</div><h1>A place for everything.</h1><p>Your floor, bay by bay. Hover or select a bay to inspect its inventory.</p></div><div class="updated">LAST CHECKED<span id="updated">—</span></div></section>
<section class="metrics"><div><label>STORAGE BAYS</label><strong>1635 <small>across 16 sections</small></strong></div><div><label>OCCUPIED</label><strong id="occupied">—</strong></div><div><label>TOTAL UNITS</label><strong id="units">—</strong></div><div><label>AVAILABLE BAYS</label><strong id="available">—</strong></div></section>
<section class="floor-panel"><div class="floor-heading"><div><h2>Warehouse floor</h2><span>TOP VIEW · SECTIONS A–R · NO I/O</span></div><div class="floor-tools"><button type="button" id="fit-toggle" aria-pressed="false" aria-controls="sections">Fit to screen</button><button type="button" id="counts-toggle" aria-pressed="false" aria-controls="sections">Show counts</button><button type="button" id="upload-counts">Upload counts</button><input id="counts-file" type="file" accept=".xlsx,.xls,.csv" hidden><span id="model-search-summary" role="status" hidden></span><div class="legend inventory-legend"><span><i></i>Stocked</span><span><i class="empty-key"></i>Empty</span><span><i class="aisle-key"></i>Forklift access</span></div><div class="legend count-legend" hidden><span><i class="match-key"></i>Count matches</span><span><i class="off-key"></i>Count differs</span><span><i class="upload-not-started-key"></i>Not Started</span><span><i class="upload-no-key"></i>Task Diff No</span><span><i class="upload-absent-key"></i>Not listed</span><span><i class="empty-key"></i>Uncounted</span></div><span id="count-summary" role="status" hidden></span><span id="upload-message" role="status" hidden></span></div></div>
<div class="map-scroll"><div class="floor"><div class="dock-doors" aria-label="Dock doors 1–48; positions 22–27 are blank"></div><div class="dock-aisle" aria-label="Horizontal forklift aisle"><span>←</span><span>DOCK ACCESS · FORKLIFT AISLE</span><span>→</span></div><div class="warehouse-sections" id="sections"></div></div></div>
<footer><span>Warehouse map · sections A–R, skipping I and O</span><span id="map-hint">Scroll horizontally to explore sections A–R ↔</span></footer></section>
<aside id="details" aria-live="polite">Select a bay to keep its inventory visible here.</aside></main><div id="tooltip" role="tooltip" hidden></div>`;
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
function createCompositeBay(row, letter, n) {
  const group = document.createElement('div');
  group.className = 'pqr-bay-row'; group.dataset.baseBay = bayId(letter, n);
  for (const subBay of 'ABCDE') createBay(group, letter, n, subBay);
  row.append(group);
}
function createColumn(row, letter, first, last) {
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
    } else if ('PQR'.includes(letter)) createCompositeBay(row, letter, n);
    else createBay(row, letter, n);
  }
}
for (const letter of sections) {
  const section = document.createElement('section');
  section.className = 'storage-section';
  section.setAttribute('aria-label', `Section ${letter}`);
  const specialLayout = `${letter === 'A' ? ' with-a-side' : ''}${'PQR'.includes(letter) ? ' with-sub-bays' : ''}`;
  section.innerHTML = `<h3>SECTION <b>${letter}</b></h3><div class="section-layout${specialLayout}">${letter === 'A' ? '<div class="bay-column a-side-column" aria-label="A-side bays 101–112"></div>' : ''}<div class="bay-column left-column"></div><div class="vertical-aisle" aria-label="Forklift aisle for section ${letter}"><span>↕</span><span>FORKLIFT AISLE</span><span>↕</span></div><div class="bay-column right-column"></div></div>`;
  document.querySelector('#sections').append(section);
  if (letter === 'A') for (let number = 101; number <= 112; number++) createBay(section.querySelector('.a-side-column'), letter, number);
  createColumn(section.querySelector('.left-column'), letter, 1, 30);
  createColumn(section.querySelector('.right-column'), letter, 41, 70);
}
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
    const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const topHeaderIndex = grid.findIndex(row => row.some(value => norm(value) === 'location') && row.some(value => norm(value) === 'model'));
    if (topHeaderIndex < 0) throw new Error('Could not find the Location and Model header row');
    const nextRowHasSubheaders = (grid[topHeaderIndex + 1] ?? []).some(value => ['ab', 'ateam', 'bteam'].includes(norm(value)));
    const headerRowIndex = nextRowHasSubheaders ? topHeaderIndex + 1 : topHeaderIndex;
    const leafHeaders = grid[headerRowIndex].map((value, col) => value || grid[topHeaderIndex][col] || '');
    const groupFor = col => {
      const merges = sheet['!merges'] ?? [];
      const merged = merges.find(range => range.s.r <= headerRowIndex && range.e.r >= headerRowIndex && range.s.c <= col && range.e.c >= col && range.s.r < headerRowIndex);
      if (merged) return sheet[XLSX.utils.encode_cell({ r: merged.s.r, c: merged.s.c })]?.v ?? '';
      return grid.slice(0, headerRowIndex).map(row => row[col]).filter(Boolean).at(-1) ?? '';
    };
    const columns = leafHeaders.map((leaf, col) => ({ col, leaf: norm(leaf), group: norm(groupFor(col)) }));
    const findCol = (predicate) => columns.find(predicate)?.col;
    const locationCol = findCol(c => c.leaf === 'location');
    const modelCol = findCol(c => c.leaf === 'model');
    const countCol = findCol(c => c.leaf === 'countqtyab' || (c.group === 'countqty' && c.leaf === 'ab'));
    const statusCol = findCol(c => c.leaf === 'status');
    const flatSystemCol = findCol(c => c.leaf === 'tasksystemqty');
    const systemTeamCols = columns.filter(c =>
      (c.group === 'tasksystemqty' && ['ateam', 'bteam'].includes(c.leaf)) ||
      ['tasksystemqtyateam', 'tasksystemqtybteam'].includes(c.leaf)
    ).map(c => c.col);
    if (locationCol === undefined || modelCol === undefined || countCol === undefined || (flatSystemCol === undefined && !systemTeamCols.length)) {
      throw new Error('Required columns: Location, Model, Count Qty A-B, and Task System Qty (or its A Team/B Team subcolumns)');
    }
    const rows = grid.slice(headerRowIndex + 1).filter(row => row.some(value => value !== ''));
    const bayIds = new Set(buttons.map(button => button.dataset.bay));
    const nextCounts = {}, nextStates = new Map(), bayComparisons = new Map();
    for (const row of rows) {
      const rawLocation = row[locationCol];
      if (!String(rawLocation ?? '').trim()) continue;
      const id = String(rawLocation).trim().toUpperCase();
      if (!bayIds.has(id)) throw new Error(`Unknown bay location: ${rawLocation}`);
      const status = statusCol === undefined ? '' : norm(row[statusCol]);
      const comparison = bayComparisons.get(id) ?? { hasCount: false, off: false, partial: false };
      comparison.partial ||= status.includes('partial');
      const rawCount = row[countCol];
      if (rawCount === '' || rawCount === undefined || rawCount === null) {
        if (comparison.partial) comparison.hasCount = true;
        bayComparisons.set(id, comparison);
        continue;
      }
      const toQty = value => value === '' || value === undefined || value === null ? 0 : Number(String(value).replaceAll(',', '').trim());
      const countQty = toQty(rawCount);
      const systemValues = flatSystemCol !== undefined ? [row[flatSystemCol]] : systemTeamCols.map(col => row[col]);
      const systemQty = systemValues.reduce((sum, value) => sum + toQty(value), 0);
      if (!Number.isSafeInteger(countQty) || countQty < 0 || systemValues.some(value => value !== '' && value !== undefined && value !== null && (!Number.isSafeInteger(toQty(value)) || toQty(value) < 0)) || !Number.isSafeInteger(systemQty)) {
        throw new Error(`Invalid count or Task System Qty for ${id}`);
      }
      comparison.hasCount = true; comparison.off ||= countQty !== systemQty;
      bayComparisons.set(id, comparison);
    }
    for (const id of bayIds) {
      const comparison = bayComparisons.get(id);
      nextStates.set(id, !comparison?.hasCount ? 'uncounted' : comparison.partial ? 'partial' : comparison.off ? 'off' : 'match');
      if (comparison?.hasCount) nextCounts[id] = [];
    }
    uploadedCounts = nextCounts;
    uploadedBayStates = nextStates;
    showCounts = true;
    savePreferences({ showCounts, showActivity: false }); applyCountView(); hideTooltip(); renderCounts(); renderSelection();
    const countedBays = [...nextStates.values()].filter(state => ['match', 'off', 'partial'].includes(state)).length;
    message.hidden = false; message.textContent = `Loaded ${countedBays} counted bays from ${file.name}`;
  } catch (error) {
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
  document.querySelector('.count-legend').innerHTML = '<span><i class="match-key"></i>Counted · same</span><span><i class="off-key"></i>Counted · different</span><span><i class="partial-key"></i>Partial</span><span><i class="uncounted-key"></i>Not counted</span>';
  countsToggle.setAttribute('aria-pressed', String(showCounts));
  countsToggle.textContent = showCounts ? 'Hide counts' : 'Show counts';
  document.body.classList.toggle('counts-view', showCounts);
  document.querySelector('.inventory-legend').hidden = showCounts;
  document.querySelector('.count-legend').hidden = !showCounts;
  document.querySelector('#count-summary').hidden = !showCounts;
}
applyCountView();
function renderCounts() {
  let matched = 0, off = 0, matchingBays = 0;
  const searchText = modelSearch.trim().toLocaleLowerCase();
  for (const button of buttons) {
    const id = button.dataset.bay;
    const uploadedState = uploadedCounts ? uploadedBayStates.get(id) : null;
    const comparison = uploadedCounts
      ? { status: uploadedState ?? 'uncounted', lines: [uploadedState === 'match' ? 'Count Qty A-B matches Task System Qty' : uploadedState === 'off' ? 'Count Qty A-B differs from Task System Qty' : uploadedState === 'partial' ? 'Partial completion' : 'Not counted yet'] }
      : compareCount(inventory[id] || [], counts[id]);
    button.dataset.countStatus = comparison.status;
    button.dataset.uploadState = '';
    matched += comparison.status === 'match' ? 1 : 0;
    off += comparison.status === 'off' ? 1 : 0;
    const items = inventory[id] || [];
    const modelMatch = Boolean(searchText) && items.some(item => item.model.toLocaleLowerCase().includes(searchText));
    button.dataset.modelMatch = String(modelMatch);
    if (modelMatch) matchingBays++;
    button.setAttribute('aria-label', `Bay ${button.dataset.baseBay}: ${showCounts ? comparison.lines.join('; ') : items.length ? items.map(i => `${i.model}: ${i.quantity}`).join(', ') : 'Empty'}`);
  }
  document.querySelectorAll('.pqr-bay-row').forEach(group => {
    const members = buttons.filter(button => button.dataset.baseBay === group.dataset.baseBay);
    const statuses = members.map(button => button.dataset.countStatus);
    const counted = statuses.filter(status => ['match', 'off', 'partial'].includes(status)).length;
    group.classList.toggle('partial-completion', statuses.includes('partial') || (counted > 0 && counted < members.length));
  });
  const loaded = uploadedCounts ? `${Object.keys(uploadedCounts).length}/${buttons.length} bays in uploaded file` : `${matched + off}/${buttons.length} counted · ${matched} match · ${off} differ`;
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
  const title = document.createElement('strong'); title.textContent = `Bay ${buttons.find(button => button.dataset.bay === id)?.dataset.baseBay ?? id}`; element.append(title);
  const items = inventory[id] || [];
  if (showCounts) {
    const uploadedState = uploadedCounts ? uploadedBayStates.get(id) : null;
    const countLines = uploadedCounts
      ? [uploadedState === 'match' ? 'Count Qty A-B matches Task System Qty' : uploadedState === 'off' ? 'Count Qty A-B differs from Task System Qty' : uploadedState === 'partial' ? 'Partial completion' : 'Not counted yet']
      : compareCount(items, counts[id]).lines;
    for (const text of countLines) {
      const line = document.createElement('span'); line.textContent = text; element.append(line);
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
  if (!lastPayload) return;
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
async function refresh() {
  try {
    const response = await fetch(import.meta.env.VITE_INVENTORY_URL || `${import.meta.env.BASE_URL}inventory.json`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    for (const button of buttons) {
      const items = data?.bays?.[button.dataset.bay];
      if (!Array.isArray(items) || items.some(i => !i || typeof i.model !== 'string' || !Number.isSafeInteger(i.quantity) || i.quantity < 0)) throw new Error('Invalid bay inventory');
    }
    const nextCounts = data.counts ?? {};
    validateCounts(nextCounts, new Set(buttons.map(button => button.dataset.bay)));
    const payload = JSON.stringify([data.bays, nextCounts]);
    if (payload !== lastPayload) {
      inventory = data.bays; counts = nextCounts; lastPayload = payload; hideTooltip();
      let occupied = 0, units = 0;
      buttons.forEach(button => {
        const items = inventory[button.dataset.bay]; occupied += items.length ? 1 : 0;
        const list = button.querySelector('.bay-items'); list.replaceChildren();
        button.classList.toggle('empty', !items.length);
        button.setAttribute('aria-label', `Bay ${button.dataset.baseBay}: ${items.length ? items.map(i => `${i.model}: ${i.quantity}`).join(', ') : 'Empty'}`);
        for (const item of items) {
          units += item.quantity;
          const line = document.createElement('span'); line.textContent = `${item.model}: ${item.quantity}`; list.append(line);
        }
        if (!items.length) list.textContent = '—';
      });
      document.querySelector('#occupied').textContent = occupied;
      document.querySelector('#available').textContent = buttons.length - occupied;
      document.querySelector('#units').textContent = units.toLocaleString();
      const models = [...new Set(Object.values(inventory).flat().map(item => item.model))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
      modelOptions.replaceChildren(...models.map(model => { const option = document.createElement('option'); option.value = model; return option; }));
      fitText(); renderCounts(); renderSelection();
    }
    document.querySelector('#status').textContent = data.demo === true ? 'Demo data · auto-refresh' : 'Connected · auto-refresh';
    document.querySelector('#status').classList.remove('error');
    document.querySelector('#updated').textContent = new Date().toLocaleTimeString();
  } catch (error) {
    document.querySelector('#status').textContent = lastPayload ? 'Connection lost · showing last data' : 'Inventory unavailable · retrying';
    document.querySelector('#status').classList.add('error'); console.error('Inventory refresh failed:', error);
  } finally { setTimeout(refresh, 5000); }
}
refresh();
// Activity heatmap refresh timer temporarily suspended with its controls.
