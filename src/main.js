import './style.css';
import { setupOrders } from './orders.js';
import { compareCount, validateCounts } from './counts.js';
import { getPreferences, savePreferences } from './preferences.js';
import { indexActivity, parseActivityTime, describeActivity } from './activity.js';

const sections = [...'ABCDEFGHJKLMN'];
const bayId = (letter, n) => `${letter}${String(n).padStart(3, '0')}`;
const preferences = getPreferences();
let inventory = {}, counts = {}, selected = preferences.selectedBay, lastPayload = '';
let showCounts = preferences.showCounts;
let showActivity = preferences.showActivity;
let activityByBay = new Map(), activitySnapshot = null, tooltipBay = null;
document.querySelector('main').outerHTML = `
<header><a href="./" class="brand"><b>▥</b> WAREHOUSE <span>/ OPERATIONS</span></a><span id="status" role="status">Connecting…</span></header>
<main>
<section class="heading"><div><div class="eyebrow">INVENTORY OVERVIEW</div><h1>A place for everything.</h1><p>Your floor, bay by bay. Hover or select a bay to inspect its inventory.</p></div><div class="updated">LAST CHECKED<span id="updated">—</span></div></section>
<section class="metrics"><div><label>STORAGE BAYS</label><strong>754 <small>across 13 sections</small></strong></div><div><label>OCCUPIED</label><strong id="occupied">—</strong></div><div><label>TOTAL UNITS</label><strong id="units">—</strong></div><div><label>AVAILABLE BAYS</label><strong id="available">—</strong></div></section>
<section class="floor-panel"><div class="floor-heading"><div><h2>Warehouse floor</h2><span>TOP VIEW · SECTIONS A–N · NO I</span></div><div class="floor-tools"><button type="button" id="fit-toggle" aria-pressed="false" aria-controls="sections">Fit to screen</button><button type="button" id="counts-toggle" aria-pressed="false" aria-controls="sections">Show counts</button><button type="button" id="activity-toggle" aria-pressed="false" aria-controls="sections">Activity heatmap</button><div class="legend activity-legend" hidden><span><i class="heat-hot"></i>≤15 min</span><span><i class="heat-warm"></i>≤1 hr</span><span><i class="heat-mild"></i>≤4 hr</span><span><i class="heat-cool"></i>≤24 hr</span><span><i class="heat-none"></i>Older / none</span></div><span id="activity-summary" role="status" hidden></span><div class="legend inventory-legend"><span><i></i>Stocked</span><span><i class="empty-key"></i>Empty</span><span><i class="aisle-key"></i>Forklift access</span></div><div class="legend count-legend" hidden><span><i class="match-key"></i>Count matches</span><span><i class="off-key"></i>Count differs</span><span><i class="empty-key"></i>Uncounted</span></div><span id="count-summary" role="status" hidden></span></div></div>
<div class="map-scroll"><div class="floor"><div class="dock-doors" aria-label="Dock doors 1–48; positions 22–27 are blank"></div><div class="dock-aisle" aria-label="Horizontal forklift aisle"><span>←</span><span>DOCK ACCESS · FORKLIFT AISLE</span><span>→</span></div><div class="warehouse-sections" id="sections"></div></div></div>
<footer><span>Trace off-count bays included in recent orders</span><span id="map-hint">Scroll horizontally to explore sections A–N ↔</span></footer></section>
<aside id="details" aria-live="polite">Select a bay to keep its inventory visible here.</aside></main><div id="tooltip" role="tooltip" hidden></div>`;
applyFitView(preferences.fitView);
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
    const button = document.createElement('button');
    button.className = 'bay'; button.dataset.bay = bayId(letter, n);
    button.innerHTML = `<span class="bay-number">${bayId(letter, n)}</span><span class="bay-items"></span><span class="bay-marker"></span>`;
    button.addEventListener('mouseenter', () => showTooltip(button));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', () => { selected = bayId(letter, n); savePreferences({ selectedBay: selected }); renderSelection(); updateOrders.traceBay(button.dataset.bay); if (document.body.classList.contains('fit-view')) showTooltip(button); });
    row.append(button);
  }
}
for (const letter of sections) {
  const section = document.createElement('section');
  section.className = 'storage-section';
  section.setAttribute('aria-label', `Section ${letter}`);
  section.innerHTML = `<h3>SECTION <b>${letter}</b></h3><div class="section-layout"><div class="bay-column left-column"></div><div class="vertical-aisle" aria-label="Forklift aisle for section ${letter}"><span>↕</span><span>FORKLIFT AISLE</span><span>↕</span></div><div class="bay-column right-column"></div></div>`;
  document.querySelector('#sections').append(section);
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
const updateOrders = setupOrders(floor);
const countsToggle = document.querySelector('#counts-toggle');
const activityToggle = document.querySelector('#activity-toggle');
activityToggle.addEventListener('click', () => {
  showActivity = !showActivity;
  if (showActivity) showCounts = false;
  savePreferences({ showActivity, showCounts });
  applyCountView();
  hideTooltip(); renderCounts(); renderSelection();
});
countsToggle.addEventListener('click', () => {
  showCounts = !showCounts;
  if (showCounts) showActivity = false;
  savePreferences({ showCounts, showActivity });
  applyCountView();
  hideTooltip(); renderCounts(); renderSelection();
});
function applyCountView() {
  countsToggle.setAttribute('aria-pressed', String(showCounts));
  countsToggle.textContent = showCounts ? 'Hide counts' : 'Show counts';
  document.body.classList.toggle('counts-view', showCounts);
  document.querySelector('.inventory-legend').hidden = showCounts || showActivity;
  activityToggle.setAttribute('aria-pressed', String(showActivity));
  activityToggle.textContent = showActivity ? 'Hide heatmap' : 'Activity heatmap';
  document.body.classList.toggle('activity-view', showActivity);
  document.querySelector('.activity-legend').hidden = !showActivity;
  document.querySelector('#activity-summary').hidden = !showActivity;
  document.querySelector('.count-legend').hidden = !showCounts;
  document.querySelector('#count-summary').hidden = !showCounts;
}
applyCountView();
function renderCounts() {
  let matched = 0, off = 0, activeBays = 0;
  const activityNow = activitySnapshot ?? Date.now();
  for (const button of buttons) {
    const id = button.dataset.bay;
    const comparison = compareCount(inventory[id] || [], counts[id]);
    button.dataset.countStatus = comparison.status;
    matched += comparison.status === 'match' ? 1 : 0;
    off += comparison.status === 'off' ? 1 : 0;
    const items = inventory[id] || [];
    const activity = describeActivity(activityByBay.get(id), activityNow, activitySnapshot !== null);
    button.dataset.activityLevel = activity.level;
    if (activity.recent) activeBays++;
    button.setAttribute('aria-label', `Bay ${id}: ${showActivity ? activity.lines.join('; ') : showCounts ? comparison.lines.join('; ') : items.length ? items.map(i => `${i.model}: ${i.quantity}`).join(', ') : 'Empty'}`);
  }
  document.querySelector('#activity-summary').textContent = `${activeBays} bays active in 24 hr${activitySnapshot !== null ? ` · Demo snapshot ${new Date(activitySnapshot).toLocaleString()}` : ''}`;
  document.querySelector('#count-summary').textContent = `${matched + off}/${buttons.length} counted · ${matched} match · ${off} differ`;
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
    : 'Scroll horizontally to explore sections A–N ↔';
}
function fillDetails(element, id) {
  element.replaceChildren();
  const title = document.createElement('strong'); title.textContent = `Bay ${id}`; element.append(title);
  const items = inventory[id] || [];
  if (showActivity) {
    for (const text of describeActivity(activityByBay.get(id), activitySnapshot ?? Date.now(), activitySnapshot !== null).lines) {
      const line = document.createElement('span'); line.textContent = text; element.append(line);
    }
  }
  if (showCounts) {
    for (const text of compareCount(items, counts[id]).lines) {
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
    const nextActivity = indexActivity(data.activity ?? [], new Set(buttons.map(button => button.dataset.bay)));
    const nextSnapshot = data.demo === true && data.activityAsOf !== undefined ? parseActivityTime(data.activityAsOf) : null;
    updateOrders(data);
    const payload = JSON.stringify([data.bays, nextCounts, data.activity ?? [], nextSnapshot]);
    if (payload !== lastPayload) {
      inventory = data.bays; counts = nextCounts; activityByBay = nextActivity; activitySnapshot = nextSnapshot; lastPayload = payload; hideTooltip();
      let occupied = 0, units = 0;
      buttons.forEach(button => {
        const items = inventory[button.dataset.bay]; occupied += items.length ? 1 : 0;
        const list = button.querySelector('.bay-items'); list.replaceChildren();
        button.classList.toggle('empty', !items.length);
        button.setAttribute('aria-label', `Bay ${button.dataset.bay}: ${items.length ? items.map(i => `${i.model}: ${i.quantity}`).join(', ') : 'Empty'}`);
        for (const item of items) {
          units += item.quantity;
          const line = document.createElement('span'); line.textContent = `${item.model}: ${item.quantity}`; list.append(line);
        }
        if (!items.length) list.textContent = '—';
      });
      document.querySelector('#occupied').textContent = occupied;
      document.querySelector('#available').textContent = buttons.length - occupied;
      document.querySelector('#units').textContent = units.toLocaleString();
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
// Let live activity cool as time passes even when the feed is unchanged.
setInterval(() => {
  if (!showActivity || !lastPayload) return;
  renderCounts(); renderSelection();
  if (tooltipBay && !document.querySelector('#tooltip').hidden) showTooltip(tooltipBay);
}, 30_000);
