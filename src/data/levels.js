/**
 * Las 9 categorías del original con sus tiempos reales.
 * `fastest` es el tiempo del mejor rival de la categoría, `slowest` el del peor.
 */
const LEVELS = [
  { id: 1, name: 'Niños',                    fastest: 14.00, slowest: 16.03, runners: 7 },
  { id: 2, name: 'Physical Festival',        fastest: 12.90, slowest: 14.43, runners: 7 },
  { id: 3, name: 'High School Competitions', fastest: 11.50, slowest: 13.12, runners: 7 },
  { id: 4, name: 'National Sport Festival',  fastest: 10.70, slowest: 11.80, runners: 7 },
  { id: 5, name: 'The Olympics',             fastest:  9.58, slowest: 10.70, runners: 7 },
  { id: 6, name: 'Cyborg',                   fastest:  9.00, slowest:  9.68, runners: 7 },
  { id: 7, name: 'Galaxy Athletes Meet',     fastest:  8.00, slowest:  9.00, runners: 7 },
  { id: 8, name: 'God Velocity',             fastest:  7.50, slowest:  7.50, runners: 1 },
  { id: 9, name: 'Yourself',                 ghost: true,                    runners: 1 },
];

const GHOST_FALLBACK = 7.50; // si aún no hay replay propio, corre God Velocity

// Contrarreloj: solo tú y el cronómetro, sin categoría ni rivales.
const TIME_TRIAL = { id: 0, name: 'Contrarreloj', runners: 0 };

/** Reparte los tiempos de los rivales dentro del rango de la categoría. */
function generateRivalTimes(level, bestTime = null) {
  if (level.ghost) return [bestTime ?? GHOST_FALLBACK];
  if (!level.runners) return [];

  const times = [];
  for (let i = 0; i < level.runners; i++) {
    const t = level.runners === 1
      ? level.fastest
      : level.fastest + (level.slowest - level.fastest) * (i / (level.runners - 1));
    times.push(t);
  }
  return times;
}

function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export { LEVELS, generateRivalTimes, getLevel, GHOST_FALLBACK, TIME_TRIAL };
