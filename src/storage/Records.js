const STORAGE_KEY = 'sprinter:records';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // modo privado o storage lleno: el juego sigue funcionando sin récords
  }
}

function getBest(key) {
  const value = readAll()[key];
  return typeof value === 'number' ? value : null;
}

/** Guarda si mejora el récord. @returns {boolean} true si era récord */
function saveBest(key, time) {
  const data = readAll();
  const previous = data[key];
  if (typeof previous === 'number' && previous <= time) return false;
  data[key] = time;
  writeAll(data);
  return true;
}

function clearRecords() {
  writeAll({});
}

export { getBest, saveBest, clearRecords };
