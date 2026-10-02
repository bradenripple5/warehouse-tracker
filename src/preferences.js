import { isMappedLocation } from './upload-counts.js';
const storageKey = 'warehouse-map.preferences.v1';
const defaults = {
  fitView: true,
  showCounts: false,
  showActivity: false,
  selectedBay: null,
  modelSearch: '',
  searchPage: 1,
  resultsOpen: false,
  legendExpanded: false,
  traceMode: 'none',
  tracedBay: null,
};
const validBay = value => value === null || (typeof value === 'string' && isMappedLocation(value));
function normalize(value) {
  const result = { ...defaults };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const key of ['fitView', 'showCounts', 'showActivity', 'resultsOpen', 'legendExpanded']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const key of ['selectedBay', 'tracedBay']) {
    if (validBay(value[key])) result[key] = value[key];
  }
  if (typeof value.modelSearch === 'string') result.modelSearch = value.modelSearch;
  if (Number.isSafeInteger(value.searchPage) && value.searchPage > 0) result.searchPage = value.searchPage;
  if (['none', 'bay', 'counts', 'recent-off'].includes(value.traceMode)) result.traceMode = value.traceMode;
  if (result.showActivity) result.showCounts = false;
  return result;
}
let preferences = { ...defaults };
try { preferences = normalize(JSON.parse(localStorage.getItem(storageKey))); } catch { /* Storage may be blocked or malformed. */ }

export function getPreferences() { return { ...preferences }; }
export function savePreferences(changes) {
  preferences = normalize({ ...preferences, ...changes });
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Keep the current session usable without storage. */ }
}
