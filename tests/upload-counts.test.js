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
  assert.deepEqual(parsed.outside, ['OFFICECAGE']);
  assert.equal(parsed.modelRows.length, 8);
  assert.equal(parsed.subdivisions.has('G022'), true);
  for (const id of ['A101', 'A112', 'B032', 'R072', 'G027G']) assert.ok(isMappedLocation(id));
  for (const id of ['G022', 'G023', 'G062', 'G063']) assert.ok(isMappedLocation(id));
  for (const id of ['G025', 'G026', 'G065', 'G066', 'P033', 'I001', 'O001']) assert.equal(isMappedLocation(id), false);
});
test('every F–R storage position and suffix is mapped except permanent forklift crossings', () => {
  for (const section of 'ABCDEFGHJKLMNPQR') {
    const crossing = section >= 'F' ? [25, 26, 65, 66] : [22, 23, 62, 63];
    const ids = [101, 141, ...Array.from({ length: 32 }, (_, i) => i + 1), ...Array.from({ length: 32 }, (_, i) => i + 41)]
      .flatMap(n => ['', 'A', 'Z'].map(suffix => ({ id: `${section}${String(n).padStart(3, '0')}${suffix}`, n })));
    for (const { id, n } of ids) assert.equal(isMappedLocation(id), !crossing.includes(n), id);
  }
  const parsed = parseCountUpload([header, subheader, ...['F022A', 'F023', 'R062', 'R063Z', 'F025'].map(id => row(id, 'Confirmed', 'Yes'))]);
  assert.deepEqual([...parsed.subdivisions.keys()], ['F022', 'F023', 'R062', 'R063']);
  assert.deepEqual(parsed.outside, ['F025']);
  assert.equal(parsed.modelRows.length, 5);
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
