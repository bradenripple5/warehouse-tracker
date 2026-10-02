import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCountUpload } from '../src/upload-counts.js';
import { summarizeMiscounts } from '../src/miscounts.js';

const header = ['Location', 'Model', 'Task System Qty', 'Count Qty A-B', 'Status', 'Task Diff Y/N'];
const summarize = rows => summarizeMiscounts(parseCountUpload([header, ...rows]).modelRows);

test('flags exclude good models even in a red bay and retain all-location totals', () => {
  const result = summarize([
    ['B001', 'OFF', 10, 6, 'Confirmed', 'Yes'],
    ['B001', 'GOOD', 10, 6, 'Confirmed', 'No'],
    ['B002', 'OFF', 10, 14, 'Confirmed', 'No'],
    ['B003', 'UNKNOWN', 10, 6, 'Confirmed', ''],
    ['B004', 'UNCOUNTED', 10, 6, 'Not Started', 'Yes'],
  ]);
  assert.deepEqual(result, [{ model: 'OFF', system: 20, counted: 20, incomplete: false, offBays: ['B001'], balanced: true }]);
});

test('Yes wins across duplicate model/location rows even with matching quantities', () => {
  const result = summarize([
    ['B001', 'OFF', 10, 10, 'Confirmed', 'Yes'],
    ['B001', 'OFF', 10, 10, 'Confirmed', 'No'],
  ]);
  assert.deepEqual(result[0].offBays, ['B001']);
  assert.equal(result[0].balanced, true);
});

test('a replacement upload with all No flags has no residual models', () => {
  assert.equal(summarize([['B001', 'OLD', 10, 6, 'Confirmed', 'Yes']]).length, 1);
  assert.deepEqual(summarize([['B001', 'NEW', 10, 6, 'Confirmed', 'No']]), []);
});

test('legacy uploads still compare summed model/location quantities', () => {
  const { modelRows } = parseCountUpload([
    header.slice(0, 4),
    ['B001', 'GOOD', 10, 6], ['B001', 'GOOD', 10, 14],
    ['B002', 'OFF', 10, 6],
  ]);
  assert.deepEqual(summarizeMiscounts(modelRows).map(row => row.model), ['OFF']);
});
