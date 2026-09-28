import { getPreferences, savePreferences } from './preferences.js';

// Order source records describe provenance; connectors are not forklift routes.
export function setupOrders(floor) {
  const preferences = getPreferences();
  const ns = 'http://www.w3.org/2000/svg';
  const stacks = document.createElement('div');
  stacks.className = 'dock-orders';
  stacks.setAttribute('aria-label', 'Dock orders. Hover over an order to show its source bays.');
  floor.querySelector('.dock-doors').after(stacks);
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('order-connections');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<defs><marker id="order-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1784d5" /></marker></defs><g class="connection-paths"></g>';
  floor.append(svg);
  const paths = svg.querySelector('g');
  const summary = document.createElement('div');
  summary.className = 'order-summary';
  summary.setAttribute('role', 'status');
  summary.hidden = true;
  document.body.append(summary);
  const bays = new Map([...floor.querySelectorAll('.bay')].map(b => [b.dataset.bay, b]));
  const searchBox = document.createElement('div');
  searchBox.className = 'model-search';
  searchBox.innerHTML = '<label for="model-search">Model</label><input id="model-search" type="search" placeholder="Search model…" autocomplete="off" /><button type="button" aria-label="Clear model search">Clear</button>';
  document.querySelector('.floor-tools').prepend(searchBox);
  const search = searchBox.querySelector('input');
  search.value = preferences.modelSearch;
  const traceBayToggle = document.createElement('button');
  traceBayToggle.type = 'button';
  traceBayToggle.id = 'trace-bay-toggle';
  traceBayToggle.textContent = 'Trace bay orders';
  traceBayToggle.setAttribute('aria-pressed', 'false');
  document.querySelector('.floor-tools').prepend(traceBayToggle);
  const traceCountToggle = document.createElement('button');
  traceCountToggle.type = 'button';
  traceCountToggle.id = 'trace-count-toggle';
  traceCountToggle.textContent = 'Trace off counts';
  traceCountToggle.setAttribute('aria-pressed', 'false');
  document.querySelector('.floor-tools').prepend(traceCountToggle);
  const recentOffToggle = document.createElement('button');
  recentOffToggle.type = 'button';
  recentOffToggle.id = 'trace-recent-off-toggle';
  recentOffToggle.textContent = 'Trace off bays in recent orders';
  recentOffToggle.setAttribute('aria-pressed', 'false');
  document.querySelector('.floor-tools').prepend(recentOffToggle);
  const results = document.createElement('details');
  results.className = 'order-search-results'; results.hidden = true;
  const resultCount = document.createElement('summary');
  const resultList = document.createElement('div');
  resultList.className = 'order-result-list';
  const pagination = document.createElement('nav');
  pagination.className = 'search-pagination';
  pagination.setAttribute('aria-label', 'Model search result pages');
  pagination.innerHTML = '<button type="button" aria-label="Previous results page">Previous</button><span role="status" aria-live="polite"></span><button type="button" aria-label="Next results page">Next</button>';
  const [previousPage, nextPage] = pagination.querySelectorAll('button');
  const pageStatus = pagination.querySelector('span');
  const pageSize = 5;
  let page = preferences.searchPage, resultMatches = [];
  results.open = preferences.resultsOpen;
  results.addEventListener('toggle', () => savePreferences({ resultsOpen: results.open }));
  previousPage.addEventListener('click', () => { page--; renderResultPage(); });
  nextPage.addEventListener('click', () => { page++; renderResultPage(); });
  results.append(resultCount, pagination, resultList); document.body.append(results);
  let held = null, tracedBay = preferences.tracedBay;
  let traceMode = preferences.traceMode === 'bay', traceCountMode = preferences.traceMode === 'counts';
  let recentOffMode = preferences.traceMode === 'recent-off';
  let frame = 0, signature = '', inventorySignature = '', countSignature = '', recentSignature = '';
  let orders = [], lines = [], systemBays = {}, countData = {}, orderNow = Date.now();
  const orderButtons = new Map();
  const query = () => search.value.trim().toLowerCase();
  function matchingSources(order) {
    const text = query();
    return order.sources.filter(source => !text || source.model?.toLowerCase().includes(text));
  }
  function offCountModels() {
    const differences = new Map();
    if (!traceCountMode && !recentOffMode) return differences;
    for (const [bay, physicalItems] of Object.entries(countData)) {
      const system = new Map(), physical = new Map();
      for (const item of systemBays[bay] ?? []) system.set(item.model, (system.get(item.model) ?? 0) + item.quantity);
      for (const item of physicalItems) physical.set(item.model, (physical.get(item.model) ?? 0) + item.quantity);
      const models = [...new Set([...system.keys(), ...physical.keys()])];
      const off = new Set(models.filter(model => (system.get(model) ?? 0) !== (physical.get(model) ?? 0)));
      if (off.size) differences.set(bay, off);
    }
    return differences;
  }
  // Combine repeated allocations of the same model from the same bay.
  function allocations(sources) {
    const grouped = new Map();
    for (const source of sources) {
      const key = JSON.stringify([source.bay, source.model]);
      const prior = grouped.get(key);
      if (!prior) grouped.set(key, { ...source });
      else prior.quantity = Number.isSafeInteger(prior.quantity) && Number.isSafeInteger(source.quantity)
        ? prior.quantity + source.quantity : undefined;
    }
    return [...grouped.values()];
  }
  const amount = source => source.quantity === undefined ? 'quantity unknown' : `${source.quantity.toLocaleString()} units`;
  function syncTraceControls() {
    traceBayToggle.setAttribute('aria-pressed', String(traceMode));
    traceBayToggle.textContent = traceMode ? 'Stop bay tracing' : 'Trace bay orders';
    traceCountToggle.setAttribute('aria-pressed', String(traceCountMode));
    traceCountToggle.textContent = traceCountMode ? 'Stop count tracing' : 'Trace off counts';
    recentOffToggle.setAttribute('aria-pressed', String(recentOffMode));
    recentOffToggle.textContent = recentOffMode ? 'Stop recent off-bay tracing' : 'Trace off bays in recent orders';
  }
  function rememberTracing() {
    savePreferences({ traceMode: recentOffMode ? 'recent-off' : traceCountMode ? 'counts' : traceMode ? 'bay' : 'none', tracedBay });
  }
  syncTraceControls();
  traceBayToggle.addEventListener('click', () => {
    traceMode = !traceMode;
    if (traceMode) { traceCountMode = false; recentOffMode = false; }
    if (!traceMode) tracedBay = null;
    syncTraceControls(); rememberTracing(); renderConnections();
  });
  traceCountToggle.addEventListener('click', () => {
    traceCountMode = !traceCountMode;
    if (traceCountMode) { traceMode = false; recentOffMode = false; tracedBay = null; held = null; }
    syncTraceControls(); rememberTracing(); renderConnections();
  });
  recentOffToggle.addEventListener('click', () => {
    recentOffMode = !recentOffMode;
    if (recentOffMode) { traceMode = false; traceCountMode = false; tracedBay = null; held = null; }
    syncTraceControls(); rememberTracing(); renderConnections();
  });
  function traceBay(id) {
    if (!traceMode) return;
    held = null;
    tracedBay = id;
    rememberTracing();
    renderConnections();
  }
  function release() {
    if (!held) return;
    held = null; renderConnections();
  }
  function draw() {
    if (!lines.length) return;
    const origin = floor.getBoundingClientRect();
    lines.forEach(({ source, button, path, label, dot }, index) => {
      const target = button.getBoundingClientRect();
      const x2 = target.left + target.width / 2 - origin.left;
      const y2 = target.bottom - origin.top;
      const rect = bays.get(source.bay).getBoundingClientRect();
      const x1 = rect.left + rect.width / 2 - origin.left;
      const y1 = rect.top - origin.top;
      const curve = Math.max(24, (y1 - y2) * .45);
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 - curve}, ${x2} ${y2 + curve}, ${x2} ${y2 + 2}`);
      dot.setAttribute('cx', x1); dot.setAttribute('cy', y1);
      const point = path.getPointAtLength(path.getTotalLength() * (.25 + (index % 3) * .15));
      label.setAttribute('x', point.x + 5); label.setAttribute('y', point.y - 5);
    });
    frame = requestAnimationFrame(draw);
  }
  function renderResultPage() {
    const pageCount = Math.max(1, Math.ceil(resultMatches.length / pageSize));
    page = Math.max(1, Math.min(page, pageCount));
    if (signature) savePreferences({ searchPage: page });
    previousPage.disabled = page === 1;
    nextPage.disabled = page === pageCount;
    pagination.hidden = resultMatches.length === 0;
    const start = (page - 1) * pageSize;
    pageStatus.textContent = `Page ${page} of ${pageCount} · ${start + 1}–${Math.min(start + pageSize, resultMatches.length)} of ${resultMatches.length}`;
    resultList.replaceChildren();
    for (const order of resultMatches.slice(start, start + pageSize)) {
      const entry = document.createElement('p');
      entry.dataset.resultOrder = order.id;
      entry.textContent = `${order.id} · Dock ${order.dock}: ${allocations(matchingSources(order)).map(s => `${s.bay} / ${s.model}: ${amount(s)}`).join('; ')}`;
      resultList.append(entry);
    }
    if (!resultMatches.length) resultList.textContent = `No orders contain a model matching “${search.value.trim()}”.`;
    resultList.scrollTop = 0;
  }
  function renderConnections() {
    cancelAnimationFrame(frame); lines = []; paths.replaceChildren();
    bays.forEach(bay => bay.classList.remove('order-source', 'trace-selected', 'count-trace-selected'));
    const text = query();
    const matches = orders.filter(order => matchingSources(order).length);
    const countDifferences = offCountModels();
    const recentOrders = recentOffMode ? orders.filter(order => {
      const createdAt = order.createdAt ? Date.parse(order.createdAt) : NaN;
      return Number.isFinite(createdAt) && createdAt <= orderNow && orderNow - createdAt <= 24 * 60 * 60 * 1000;
    }) : [];
    const eligibleRecentIds = new Set(recentOrders.filter(order => matchingSources(order).some(source =>
      countDifferences.get(source.bay)?.has(source.model))).map(order => order.id));
    orderButtons.forEach((button, id) => {
      button.classList.toggle('held', held?.id === id);
      button.setAttribute('aria-pressed', String(held?.id === id));
      button.classList.toggle('search-match', !!text && matches.some(order => order.id === id));
      button.classList.toggle('search-muted', !!text && !matches.some(order => order.id === id));
      button.classList.toggle('recent-off-match', eligibleRecentIds.has(id));
    });
    results.hidden = !text;
    resultList.replaceChildren();
    if (text) {
      const sources = matches.flatMap(order => matchingSources(order));
      const total = sources.reduce((sum, source) => sum + (source.quantity ?? 0), 0);
      resultCount.textContent = `${matches.length} orders · ${total.toLocaleString()} known units${sources.some(s => s.quantity === undefined) ? ' · some quantities unknown' : ''}`;
      resultMatches = matches;
      renderResultPage();
    }
    const tracedOrders = tracedBay ? orders.filter(order => matchingSources(order).some(source => source.bay === tracedBay)) : [];
    const countOrders = traceCountMode ? orders.filter(order => matchingSources(order).some(source =>
      countDifferences.get(source.bay)?.has(source.model))) : [];
    const recentOffOrders = recentOrders.filter(order => matchingSources(order).some(source => countDifferences.get(source.bay)?.has(source.model)));
    const shown = held ? [held] : recentOffMode ? recentOffOrders : traceCountMode ? countOrders : traceMode && tracedBay ? tracedOrders : text ? matches : [];
    if (traceMode && tracedBay) bays.get(tracedBay)?.classList.add('trace-selected');
    if (traceCountMode) countDifferences.forEach((models, bay) => {
      if (!text || [...models].some(model => model.toLowerCase().includes(text))) bays.get(bay)?.classList.add('count-trace-selected');
    });
    for (const order of shown) {
      const button = orderButtons.get(order.id);
      const sources = recentOffMode && !held
        ? matchingSources(order).filter(source => countDifferences.get(source.bay)?.has(source.model))
        : traceMode && tracedBay && !held
        ? matchingSources(order).filter(source => source.bay === tracedBay)
        : traceCountMode && !held
          ? matchingSources(order).filter(source => countDifferences.get(source.bay)?.has(source.model))
          : matchingSources(order);
      for (const source of allocations(sources)) {
        bays.get(source.bay).classList.add('order-source');
        const path = document.createElementNS(ns, 'path');
        path.dataset.order = order.id; path.dataset.bay = source.bay;
        path.setAttribute('marker-end', 'url(#order-arrow)');
        const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('r', '3');
        const label = document.createElementNS(ns, 'text');
        label.textContent = `${source.bay} · ${source.model ? `${source.model}: ` : ''}${amount(source)}`;
        paths.append(path, dot, label);
        lines.push({ source, button, path, dot, label });
      }
    }
    if (recentOffMode) countDifferences.forEach((models, bay) => {
      if (recentOffOrders.some(order => matchingSources(order).some(source => source.bay === bay && models.has(source.model)))) {
        bays.get(bay)?.classList.add('count-trace-selected');
      }
    });
    summary.hidden = !held && !(traceMode && tracedBay) && !traceCountMode && !recentOffMode;
    if (held) summary.textContent = `${held.id} · Dock ${held.dock} · ${matchingSources(held).length} matching source records → order`;
    else if (traceMode && tracedBay) summary.textContent = `${tracedBay} → ${tracedOrders.length} matching order${tracedOrders.length === 1 ? '' : 's'}${tracedOrders.length ? ` · ${tracedOrders.map(order => order.id).join(', ')}` : ''}`;
    else if (traceCountMode) summary.textContent = `${countDifferences.size} off-count bays · ${countOrders.length} related orders${text ? ` matching “${search.value.trim()}”` : ''}`;
    else if (recentOffMode) {
      const bayCount = new Set(recentOffOrders.flatMap(order => matchingSources(order)
        .filter(source => countDifferences.get(source.bay)?.has(source.model)).map(source => source.bay))).size;
      summary.textContent = `${bayCount} off-count bays pulled for ${recentOffOrders.length} orders created in the last 24 hours`;
    }
    draw();
  }
  function hold(button, order) {
    document.querySelector('#tooltip').hidden = true;
    held = order; renderConnections();
  }
  search.addEventListener('input', () => { page = 1; held = null; savePreferences({ modelSearch: search.value, searchPage: page }); renderConnections(); });
  searchBox.querySelector('button').addEventListener('click', () => {
    search.value = ''; page = 1; held = null; savePreferences({ modelSearch: '', searchPage: page }); renderConnections(); search.focus();
  });
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') release(); });
  document.querySelector('#fit-toggle').addEventListener('click', release);

  function updateOrders(data) {
    const incoming = data.orders ?? [];
    // Preserve legacy bay-only provenance, but never invent its quantities.
    if (!Array.isArray(incoming) || incoming.some(order => !order || typeof order.id !== 'string' ||
      !Number.isInteger(order.dock) || order.dock < 1 || order.dock > 48 || (order.dock >= 22 && order.dock <= 27) ||
      (order.createdAt !== undefined && (typeof order.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(order.createdAt) || !Number.isFinite(Date.parse(order.createdAt)))) ||
      !Array.isArray(order.sources) || order.sources.some(source => !source || !bays.has(source.bay) ||
        (source.model !== undefined && typeof source.model !== 'string') ||
        (source.quantity !== undefined && (!Number.isSafeInteger(source.quantity) || source.quantity < 0)))) ||
      new Set(incoming.map(order => order.id)).size !== incoming.length) throw new Error('Invalid dock orders or source bays');
    document.querySelector('footer > span').textContent = `${data.demo === true ? 'Demo orders · ' : ''}Hover over orders or trace off-count bays in recent orders`;
    systemBays = data.bays ?? {};
    countData = data.counts ?? {};
    orderNow = data.demo === true && data.activityAsOf ? Date.parse(data.activityAsOf) : Date.now();
    const next = JSON.stringify(incoming);
    const nextInventory = JSON.stringify(systemBays);
    const nextCounts = JSON.stringify(countData);
    const nextRecent = JSON.stringify(incoming.filter(order => {
      const createdAt = order.createdAt ? Date.parse(order.createdAt) : NaN;
      return Number.isFinite(createdAt) && createdAt <= orderNow && orderNow - createdAt <= 24 * 60 * 60 * 1000;
    }).map(order => order.id));
    if (next === signature && nextInventory === inventorySignature && nextCounts === countSignature && nextRecent === recentSignature) return;
    const ordersChanged = next !== signature;
    signature = next;
    inventorySignature = nextInventory;
    countSignature = nextCounts;
    recentSignature = nextRecent;
    if (!ordersChanged) { renderConnections(); return; }
    held = null; orders = incoming; stacks.replaceChildren(); orderButtons.clear();
    for (let dock = 1; dock <= 48; dock++) {
      const stack = document.createElement('div'); stack.className = 'order-stack';
      stack.dataset.dock = dock;
      for (const order of orders.filter(order => order.dock === dock)) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'dock-order'; button.textContent = order.id;
        button.dataset.order = order.id;
        button.setAttribute('aria-label', `${order.id}, dock ${dock}. Hover or focus to show source bays: ${order.sources.map(s => s.bay).join(', ') || 'none recorded'}`);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('pointerenter', () => hold(button, order));
        button.addEventListener('pointerleave', release);
        button.addEventListener('focus', () => hold(button, order));
        button.addEventListener('blur', release);
        orderButtons.set(order.id, button);
        stack.append(button);
      }
      stacks.append(stack);
    }
    renderConnections();
  }
  // Called by bay clicks in the map's order tracing mode.
  updateOrders.traceBay = traceBay;
  return updateOrders;
}
