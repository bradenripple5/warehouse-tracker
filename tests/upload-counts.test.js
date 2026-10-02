import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCountUpload, isMappedLocation } from '../src/upload-counts.js';

const header = ['Status', 'Location', 'Model', 'Task System Qty', 'Count Qty', '', '', 'Task System Qty', '', 'Task Diff Y/N'];
const subheader = ['', '', '', '', 'A Team', 'B Team', 'A - B', 'A Team', 'B Team', ''];
const row = (id, status, diff, counted = 10) => [status, id, 'MODEL', 10, counted, '', counted, 999, 999, diff];
test('export flags control colors, and Not Started overrides No and placeholder counts', () => {
  const parsed = parseCountUpload([header, subheader, row('A001', 'Not Started', 'No'), row('B050', 'Processing', 'Yes'), row('B051', 'Processing', 'No', 7), row('B052', 'Confirmed', 'No')]);
  assert.equal(parsed.states.get('A001'), 'not-started');
  assert.equal(parsed.modelRows[0].counted, null);
  assert.equal(parsed.states.get('B050'), 'off');
  assert.equal(parsed.states.get('B051'), 'match');
  assert.equal(parsed.states.get('B052'), 'match');
  assert.equal(parsed.modelRows[0].system, 10);
});
test('subdivisions use unique listed suffixes and outside locations remain in totals', () => {
  const parsed = parseCountUpload([header, subheader, ...['B021A', 'B021B', 'B021D', 'B021D', 'G027G', 'P032C', 'G022', 'OFFICECAGE'].map(id => row(id, 'Processing', 'No'))]);
  assert.deepEqual([...parsed.subdivisions.get('B021')], ['A', 'B', 'D']);
  assert.deepEqual(parsed.outside, ['G022', 'OFFICECAGE']);
  assert.equal(parsed.modelRows.length, 8);
  assert.equal(parsed.subdivisions.has('G022'), false);
  for (const id of ['A101', 'A112', 'B032', 'R072', 'G027G']) assert.ok(isMappedLocation(id));
  for (const id of ['G022', 'G023', 'G062', 'G063', 'P033', 'I001', 'O001']) assert.equal(isMappedLocation(id), false);
});
test('duplicate locations with any Yes are red and blank flags stay unknown', () => {
  const parsed = parseCountUpload([header, subheader, row('B001', 'Processing', 'No'), row('B001', 'Processing', 'Yes'), row('B002', 'Processing', '')]);
  assert.equal(parsed.states.get('B001'), 'off');
  assert.equal(parsed.states.get('B002'), 'uncounted');
});
test('legacy flat format sums model rows before comparing', () => {
  const parsed = parseCountUpload([['Location', 'Model', 'Count Qty A-B', 'Task System Qty'], ['B001', 'MODEL', 8, 10], ['B001', 'MODEL', 12, 10]]);
  assert.equal(parsed.states.get('B001'), 'match');
});
test('invalid quantities and conflicting parent/sub-bay records reject the upload', () => {
  assert.throws(() => parseCountUpload([header, subheader, row('B001', 'Processing', 'No', -1)]), /Invalid count/);
  assert.throws(() => parseCountUpload([header, subheader, row('B001', 'Processing', 'Maybe')]), /Invalid Task Diff/);
  assert.throws(() => parseCountUpload([header, subheader, row('B001', 'Processing', 'No'), row('B001A', 'Processing', 'No')]), /Both B001/);
});
