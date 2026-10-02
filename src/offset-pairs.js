// Pairs are possible explanations, not inventory corrections. Return all exact
// offsets rather than arbitrarily choosing a match when several are possible.
export function findOffsetPairs(rows, states) {
  const bays = new Map();
  for (const { bay, model, system, counted, partial } of rows) {
    // Upload status is authoritative: numeric differences alone may be green.
    if (states && states.get(bay) !== 'off') continue;
    if (!model) continue;
    if (!bays.has(bay)) bays.set(bay, new Map());
    const models = bays.get(bay);
    const entry = models.get(model) ?? { delta: 0, complete: true };
    entry.delta += (counted ?? 0) - system;
    entry.complete &&= counted !== null && !partial;
    models.set(model, entry);
  }
  const byModel = new Map();
  for (const [bay, models] of bays) {
    for (const [model, entry] of models) {
      if (!entry.complete || !entry.delta) continue;
      if (!byModel.has(model)) byModel.set(model, new Map());
      const quantities = byModel.get(model);
      const quantity = Math.abs(entry.delta);
      if (!quantities.has(quantity)) quantities.set(quantity, { extra: [], short: [] });
      quantities.get(quantity)[entry.delta > 0 ? 'extra' : 'short'].push(bay);
    }
  }
  const pairs = [];
  for (const [model, quantities] of byModel) {
    for (const [quantity, { extra, short }] of quantities) {
      for (const from of extra) for (const to of short) pairs.push({ model, from, to, quantity });
    }
  }
  return pairs;
}

export function setupOffsetArrows(floor, buttons) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('offset-connections');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = '<defs><marker id="offset-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="#7c3aed"/></marker></defs><g></g>';
  floor.append(svg);
  let pairs = [], frame;
  function draw() {
    const byId = new Map(buttons.map(button => [button.dataset.bay, button]));
    const bounds = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const group = svg.querySelector('g'); group.replaceChildren();
    if (!pairs.length || !bounds.width || !bounds.height) return;
    // Convert viewport positions into the overlay's own coordinate system.
    // Its grid placement/scale need not match the floor's bounding rectangle.
    const transform = svg.getScreenCTM()?.inverse();
    if (!transform) return;
    const labels = document.createDocumentFragment();
    for (const pair of pairs) {
      if (!byId.has(pair.from) || !byId.has(pair.to)) continue;
      const a = byId.get(pair.from).getBoundingClientRect();
      const b = byId.get(pair.to).getBoundingClientRect();
      const path = document.createElementNS(ns, 'path');
      const { x: x1, y: y1 } = new DOMPoint(a.left + a.width / 2, a.top + a.height / 2).matrixTransform(transform);
      const { x: x2, y: y2 } = new DOMPoint(b.left + b.width / 2, b.top + b.height / 2).matrixTransform(transform);
      path.dataset.from = pair.from; path.dataset.to = pair.to;
      path.setAttribute('d', `M${x1},${y1} L${x2},${y2}`);
      path.setAttribute('marker-end', 'url(#offset-arrow)');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${pair.model}: ${pair.quantity} units extra at ${pair.from}, short at ${pair.to}`;
      path.append(title); group.append(path);
      const label = document.createElementNS(ns, 'text');
      label.classList.add('offset-quantity');
      label.setAttribute('x', (x1 + x2) / 2);
      label.setAttribute('y', (y1 + y2) / 2);
      label.textContent = String(pair.quantity);
      labels.append(label);
    }
    // Keep quantities above every line, including crossing arrows.
    group.append(labels);
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }
  new ResizeObserver(schedule).observe(floor);
  // Aisle width and fit-mode changes can move bays without resizing the floor.
  new ResizeObserver(schedule).observe(floor.querySelector('.warehouse-sections'));
  window.addEventListener('resize', schedule);
  return nextPairs => { pairs = nextPairs; schedule(); };
}
