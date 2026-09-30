import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/samples');
const models = JSON.parse(fs.readFileSync(path.join(output, 'lg-model-sources.json'), 'utf8'));
const sections = [...'ABCDEFGHJKLMNPQR'];
const numbers = [101, ...Array.from({ length: 30 }, (_, i) => i + 1).filter(n => n !== 22 && n !== 23),
  141, ...Array.from({ length: 30 }, (_, i) => i + 41).filter(n => n !== 62 && n !== 63)];
const rows = [['Location', 'Model', 'Status', 'Task Diff Y/N', 'Task System Qty', 'Count Qty A-B']];
const placements = new Map(models.map(model => [model.model, 0]));
let matches = 0, differences = 0, uncounted = 0, partials = 0;
for (const [sectionIndex, section] of sections.entries()) {
  for (const [position, number] of numbers.entries()) {
    const suffixes = 'PQR'.includes(section) ? [...'ABCDE'] : [''];
    for (const suffix of suffixes) {
      const index = rows.length - 1;
      const model = models[(index * 73) % models.length].model;
      const system = number === 101 || number === 141 ? 0 : 1 + (index * 11) % 24;
      const pending = [0, 10, 20, 29, 40].includes(position);
      const off = position === 5 || (sectionIndex < 2 && position === 6);
      const partial = section === 'P' && number === 28 && suffix === 'C';
      const actual = pending ? '' : partial ? Math.floor(system / 2) : off ? system + (sectionIndex % 2 ? -1 : 2) : system;
      rows.push([`${section}${String(number).padStart(3, '0')}${suffix}`, model,
        pending ? 'Not Started' : partial ? 'Partial' : 'Completed', pending ? '' : off ? 'Yes' : 'No', system, actual]);
      placements.set(model, placements.get(model) + 1);
      if (pending) uncounted++; else if (partial) partials++; else if (off) differences++; else matches++;
    }
  }
  if (section === 'A') for (let number = 102; number <= 112; number++) {
    const index = rows.length - 1;
    const model = models[(index * 73) % models.length].model;
    const system = 1 + (index * 11) % 24;
    rows.push([`A${number}`, model, 'Completed', 'No', system, system]);
    placements.set(model, placements.get(model) + 1); matches++;
  }
}

const workbook = XLSX.utils.book_new();
const counts = XLSX.utils.aoa_to_sheet(rows);
counts['!cols'] = [14, 22, 18, 20, 22, 22].map(wch => ({ wch }));
counts['!autofilter'] = { ref: counts['!ref'] };
XLSX.utils.book_append_sheet(workbook, counts, 'Sample Counts');
const notes = XLSX.utils.aoa_to_sheet([
  ['DEMO WAREHOUSE COUNTS — synthetic quantities and bay assignments'],
  ['Distinct LG appliance models', models.length],
  ['Warehouse bays', rows.length - 1],
  ['Matching counted bays (green)', matches],
  ['Discrepant counted bays (red)', differences],
  ['Partial bays (yellow)', partials],
  ['Not counted (blank Count Qty A-B)', uncounted],
  ['Upload', 'Select this workbook with Upload counts. The first worksheet is imported.'],
  ['Comparison', 'Task System Qty is the expected amount; Count Qty A-B is the actual count used by this app.'],
  ['Headers', 'Count Qty A-B is the supported single-row spelling of Count Qty > A-B.'],
  ['Partial completion', 'P028C has Status=Partial to demonstrate yellow progress highlighting.'],
  ['Scope', 'The current uploader updates count colors only. Inventory model lists and orders still come from the inventory feed.'],
  ['Not Started', 'Leave Count Qty A-B blank; zero is a recorded count of zero.'],
  ['Models', 'Model identifiers come from LG USA product URLs; this includes older/discontinued models.'],
  ['Source', 'https://www.lg.com/us/sitemap.xml'],
  ['Source retrieved', '2026-09-30'],
  ['Distribution', 'All 16 sections A-H, J-N, and P-R; P-R has sub-bays A-E.'],
  ['Persistence', 'Uploaded data lasts for this browser session only.'],
]);
notes['!cols'] = [{ wch: 44 }, { wch: 115 }];
XLSX.utils.book_append_sheet(workbook, notes, 'Read Me');
const sources = XLSX.utils.aoa_to_sheet([
  ['Model', 'Category', 'Bay rows', 'Official LG product URL'],
  ...models.map(model => [model.model, model.category, placements.get(model.model), model.source]),
]);
sources['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 100 }];
for (let row = 2; row <= models.length + 1; row++) sources[`D${row}`].l = { Target: models[row - 2].source };
XLSX.utils.book_append_sheet(workbook, sources, 'LG Model Sources');
XLSX.writeFile(workbook, path.join(output, 'lg-200-model-counts.xlsx'), { compression: true });
console.log(JSON.stringify({ models: models.length, bays: rows.length - 1, matches, differences, partials, uncounted }));
