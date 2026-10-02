import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCountUpload } from '../src/upload-counts.js';
import { findOffsetPairs } from '../src/offset-pairs.js';

test('only red upload locations qualify despite equal numeric offsets at other statuses', () => {
  const parsed = parseCountUpload([
    ['Location', 'Model', 'Task System Qty', 'Count Qty A-B', 'Status', 'Task Diff Y/N'],
    ['B005', 'MODEL', 10, 14, 'Confirmed', 'Yes'],
    ['R072Z', 'MODEL', 10, 6, 'Confirmed', 'Yes'],
    ['P028A', 'MODEL', 10, 14, 'Confirmed', 'No'],
    ['Q028B', 'MODEL', 10, 6, 'Confirmed', 'No'],
    ['B007', 'MODEL', 10, 6, 'Not Started', 'No'],
    ['B008', 'MODEL', 10, 6, 'Confirmed', ''],
  ]);
  assert.deepEqual(findOffsetPairs(parsed.modelRows, parsed.states), [
    { model: 'MODEL', from: 'B005', to: 'R072Z', quantity: 4 },
  ]);
});
