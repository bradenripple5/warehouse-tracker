// Parse the warehouse export independently of its current map geometry.
import { isForkliftCrossing } from './layout.js';
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const blank = value => value === '' || value === undefined || value === null;
const quantity = value => blank(value) ? 0 : Number(String(value).replaceAll(',', '').trim());

export function isMappedLocation(id) {
  const match = /^([A-HJ-NP-R])(\d{3})([A-Z]*)$/.exec(id);
  if (!match) return false;
  const n = Number(match[2]);
  return (match[1] === 'A' && n >= 101 && n <= 112) || n === 101 || n === 141 ||
    (((n >= 1 && n <= 32) || (n >= 41 && n <= 72)) && !isForkliftCrossing(match[1], n));
}

export function parseCountUpload(grid) {
  const header = grid.findIndex(row => row.some(v => norm(v) === 'location') && row.some(v => norm(v) === 'model'));
  if (header < 0) throw new Error('Could not find the Location and Model header row');
  const nested = (grid[header + 1] ?? []).some(v => ['ab', 'ateam', 'bteam'].includes(norm(v)));
  const width = Math.max(grid[header].length, nested ? grid[header + 1].length : 0);
  let group = '';
  const columns = Array.from({ length: width }, (_, col) => {
    if (!blank(grid[header][col])) group = norm(grid[header][col]);
    return { col, group, leaf: norm(nested ? grid[header + 1][col] || grid[header][col] : grid[header][col]) };
  });
  const find = predicate => columns.find(predicate)?.col;
  const locationCol = find(c => c.leaf === 'location');
  const modelCol = find(c => c.leaf === 'model');
  const countCol = find(c => c.leaf === 'countqtyab' || (c.group === 'countqty' && c.leaf === 'ab'));
  const statusCol = find(c => c.leaf === 'status');
  const diffCol = find(c => ['taskdiffyn', 'taskdiff'].includes(c.leaf));
  const systemCol = find(c => c.leaf === 'tasksystemqty');
  const teamCols = columns.filter(c => (c.group === 'tasksystemqty' && ['ateam', 'bteam'].includes(c.leaf)) || ['tasksystemqtyateam', 'tasksystemqtybteam'].includes(c.leaf)).map(c => c.col);
  if (locationCol === undefined || modelCol === undefined || countCol === undefined || (systemCol === undefined && !teamCols.length)) {
    throw new Error('Required columns: Location, Model, Count Qty A-B, and Task System Qty');
  }
  const modelRows = [], locations = new Map(), subdivisions = new Map();
  for (const row of grid.slice(header + (nested ? 2 : 1))) {
    if (blank(row[locationCol])) continue;
    const id = String(row[locationCol]).trim().toUpperCase();
    if (!id) continue;
    const status = norm(row[statusCol]), diff = norm(row[diffCol]);
    if (diffCol !== undefined && diff && !['yes', 'no'].includes(diff)) throw new Error(`Invalid Task Diff Y/N for ${id}`);
    const notStarted = status === 'notstarted', partial = status.includes('partial');
    const values = systemCol !== undefined ? [row[systemCol]] : teamCols.map(col => row[col]);
    const system = values.reduce((sum, value) => sum + quantity(value), 0);
    const counted = notStarted || blank(row[countCol]) ? null : quantity(row[countCol]);
    if (values.some(value => !Number.isSafeInteger(quantity(value)) || quantity(value) < 0) || !Number.isSafeInteger(system) || (counted !== null && (!Number.isSafeInteger(counted) || counted < 0))) {
      throw new Error(`Invalid count or Task System Qty for ${id}`);
    }
    const model = String(row[modelCol] ?? '').trim();
    if (!model && (system || counted)) throw new Error(`Missing model for ${id}`);
    modelRows.push({ bay: id, model, system, counted, partial,
      discrepancy: diffCol === undefined ? undefined : !notStarted && diff === 'yes' });
    const entry = locations.get(id) ?? { notStarted: false, partial: false, yes: false, no: false, unknown: false, models: new Map() };
    entry.notStarted ||= notStarted;
    entry.partial ||= partial;
    entry.yes ||= !notStarted && diff === 'yes';
    entry.no ||= !notStarted && diff === 'no';
    entry.unknown ||= !notStarted && diffCol !== undefined && !diff;
    const totals = entry.models.get(model) ?? { system: 0, counted: 0, missing: false };
    totals.system += system; totals.counted += counted ?? 0; totals.missing ||= counted === null;
    entry.models.set(model, totals);
    locations.set(id, entry);
    if (isMappedLocation(id)) {
      const base = id.slice(0, 4), suffix = id.slice(4);
      if (!subdivisions.has(base)) subdivisions.set(base, new Set());
      subdivisions.get(base).add(suffix);
    }
  }
  if (!locations.size) throw new Error('No location rows found');
  for (const [base, suffixes] of subdivisions) {
    if (suffixes.has('') && suffixes.size > 1) throw new Error(`Both ${base} and its subdivisions are listed; use one location scheme per bay`);
  }
  const states = new Map();
  for (const [id, entry] of locations) {
    const totals = [...entry.models.values()];
    const state = entry.yes ? 'off' : entry.notStarted ? 'not-started' : entry.partial ? 'partial' :
      diffCol !== undefined ? (entry.no && !entry.unknown ? 'match' : 'uncounted') :
      totals.some(t => t.missing) ? 'uncounted' : totals.some(t => t.system !== t.counted) ? 'off' : 'match';
    states.set(id, state);
  }
  return { modelRows, states, subdivisions, flagged: diffCol !== undefined,
    outside: [...locations.keys()].filter(id => !isMappedLocation(id)) };
}
