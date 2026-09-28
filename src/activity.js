const minute = 60_000;
const day = 24 * 60 * minute;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseActivityTime(value) {
  if (typeof value !== 'string' || !timestampPattern.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Activity timestamps must be ISO dates with a timezone');
  }
  return Date.parse(value);
}

export function indexActivity(events, bayIds) {
  if (!Array.isArray(events)) throw new Error('Invalid activity events');
  const byBay = new Map();
  for (const event of events) {
    if (!event || !bayIds.has(event.bay) || typeof event.type !== 'string' || !event.type.trim() ||
      (event.model !== undefined && typeof event.model !== 'string') ||
      (event.quantity !== undefined && (!Number.isSafeInteger(event.quantity) || event.quantity < 0))) {
      throw new Error('Invalid bay activity');
    }
    const record = { ...event, time: parseActivityTime(event.at) };
    if (!byBay.has(event.bay)) byBay.set(event.bay, []);
    byBay.get(event.bay).push(record);
  }
  for (const records of byBay.values()) records.sort((a, b) => b.time - a.time);
  return byBay;
}

export function describeActivity(records = [], now = Date.now(), demoSnapshot = false) {
  // Future-dated events must not make a bay look recently active.
  const past = records.filter(event => event.time <= now);
  const latest = past[0];
  if (!latest) return { level: 'none', recent: 0, lines: ['No recorded activity'] };
  const age = now - latest.time;
  const level = age <= 15 * minute ? 'hot' : age <= 60 * minute ? 'warm' : age <= 240 * minute ? 'mild' : age <= day ? 'cool' : 'old';
  const recent = past.filter(event => now - event.time <= day).length;
  const elapsed = age < minute ? 'under a minute' : age < 60 * minute ? `${Math.floor(age / minute)} min` : age < day ? `${Math.floor(age / (60 * minute))} hr` : `${Math.floor(age / day)} days`;
  const detail = [latest.type, latest.model, latest.quantity === undefined ? null : `${latest.quantity.toLocaleString()} units`].filter(Boolean).join(' · ');
  return {
    level, recent,
    lines: [
      `Last activity: ${elapsed} ${demoSnapshot ? 'before demo snapshot' : 'ago'}`,
      detail,
      new Date(latest.time).toLocaleString(),
      `${recent} event${recent === 1 ? '' : 's'} in the last 24 hours${demoSnapshot ? ' of the snapshot' : ''}`,
    ],
  };
}
