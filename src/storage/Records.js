const RECORDS_KEY = 'sprinter:records';
const PROGRESS_KEY = 'sprinter:progress';
const GHOST_KEY = 'sprinter:ghost';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    // modo privado o storage lleno: el juego sigue funcionando sin guardar
    return false;
  }
}

function getBest(key) {
  const value = read(RECORDS_KEY, {})[key];
  return typeof value === 'number' ? value : null;
}

/** Guarda si mejora el récord. @returns {boolean} true si era récord */
function saveBest(key, time) {
  const data = read(RECORDS_KEY, {});
  const previous = data[key];
  if (typeof previous === 'number' && previous <= time) return false;
  data[key] = time;
  write(RECORDS_KEY, data);
  return true;
}

/** Categoría más alta desbloqueada. La 1 siempre lo está. */
function getUnlocked() {
  const value = read(PROGRESS_KEY, {}).unlocked;
  return typeof value === 'number' ? Math.max(1, value) : 1;
}

/** @returns {boolean} true si esta categoría no estaba desbloqueada ya */
function unlockLevel(id) {
  if (id <= getUnlocked()) return false;
  write(PROGRESS_KEY, { unlocked: id });
  return true;
}

/**
 * Replay de la mejor carrera de God Velocity, para el nivel 9.
 * @returns {{samples: number[], time: number} | null}
 */
function getGhost() {
  const ghost = read(GHOST_KEY, null);
  return Array.isArray(ghost?.samples) && ghost.samples.length >= 4 ? ghost : null;
}

/** Guarda el replay solo si la carrera mejora al fantasma actual. */
function saveGhost(samples, time) {
  const current = getGhost();
  if (current && current.time <= time) return false;
  return write(GHOST_KEY, { samples, time });
}

function clearAll() {
  [RECORDS_KEY, PROGRESS_KEY, GHOST_KEY].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // sin storage no hay nada que borrar
    }
  });
}

export { getBest, saveBest, getUnlocked, unlockLevel, getGhost, saveGhost, clearAll };
