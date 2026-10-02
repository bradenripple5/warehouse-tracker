// Aggregate duplicate rows within each location before identifying miscounts.
export function summarizeMiscounts(rows) {
  const models = new Map();
  for (const { bay, model, system, counted, partial = false, discrepancy } of rows) {
    if (!model) continue;
    if (!models.has(model)) models.set(model, new Map());
    const locations = models.get(model);
    const entry = locations.get(bay) ?? { system: 0, counted: 0, incomplete: false, hasCount: false, flagged: false, discrepancy: false };
    entry.system += system;
    entry.counted += counted ?? 0;
    entry.hasCount ||= counted !== null;
    entry.incomplete ||= counted === null || partial;
    entry.flagged ||= discrepancy !== undefined;
    entry.discrepancy ||= discrepancy === true;
    locations.set(bay, entry);
  }
  const result = [];
  for (const [model, locations] of models) {
    // Flags determine membership; quantities still determine whole-model totals.
    const offBays = [...locations].filter(([, entry]) => entry.flagged
      ? entry.discrepancy
      : entry.hasCount && entry.system !== entry.counted).map(([bay]) => bay);
    if (!offBays.length) continue;
    const entries = [...locations.values()];
    const system = entries.reduce((sum, entry) => sum + entry.system, 0);
    const counted = entries.reduce((sum, entry) => sum + entry.counted, 0);
    const incomplete = entries.some(entry => entry.incomplete);
    result.push({ model, system, counted, incomplete, offBays, balanced: !incomplete && system === counted });
  }
  return result.sort((a, b) => a.model.localeCompare(b.model));
}

export function inventoryCountRows(inventory, counts) {
  const rows = [];
  for (const bay of new Set([...Object.keys(inventory), ...Object.keys(counts)])) {
    const totals = new Map();
    for (const item of inventory[bay] ?? []) {
      const entry = totals.get(item.model) ?? { system: 0, counted: counts[bay] === undefined ? null : 0 };
      entry.system += item.quantity;
      totals.set(item.model, entry);
    }
    for (const item of counts[bay] ?? []) {
      const entry = totals.get(item.model) ?? { system: 0, counted: 0 };
      entry.counted += item.quantity;
      totals.set(item.model, entry);
    }
    for (const [model, quantities] of totals) rows.push({ bay, model, ...quantities });
  }
  return rows;
}
