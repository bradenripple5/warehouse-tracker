// A–E retain the original crossing; F–R cross three positions farther down.
export function crossingStart(section, first = 1) {
  return first + (section >= 'F' ? 24 : 21);
}

export function isForkliftCrossing(section, number) {
  const start = crossingStart(section, number >= 41 ? 41 : 1);
  return number === start || number === start + 1;
}
