export function validateCounts(counts, bayIds) {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error('Invalid bay counts');
  for (const [id, items] of Object.entries(counts)) {
    if (!bayIds.has(id) || !Array.isArray(items) || items.some(item => !item || typeof item.model !== 'string' ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 0)) throw new Error(`Invalid count for bay ${id}`);
  }
}

export function compareCount(systemItems, countedItems) {
  if (countedItems === undefined) return { status: 'uncounted', lines: ['Not counted yet'] };
  const totals = items => {
    const result = new Map();
    for (const { model, quantity } of items) result.set(model, (result.get(model) || 0) + quantity);
    return result;
  };
  const system = totals(systemItems), counted = totals(countedItems);
  const models = new Set([...system.keys(), ...counted.keys()]);
  let mismatch = false;
  const lines = [];
  for (const model of models) {
    const expected = system.get(model) || 0, actual = counted.get(model) || 0;
    const delta = actual - expected;
    mismatch ||= delta !== 0;
    const difference = delta > 0 ? `over by ${delta.toLocaleString()}` : delta < 0 ? `short by ${(-delta).toLocaleString()}` : 'matches';
    lines.push(`${model}: system ${expected.toLocaleString()} · counted ${actual.toLocaleString()} · ${difference}`);
  }
  return { status: mismatch ? 'off' : 'match', lines: [mismatch ? 'Count discrepancy' : 'Count matches system', ...lines.length ? lines : ['System 0 · counted 0']] };
}
