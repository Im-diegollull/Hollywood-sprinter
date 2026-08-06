/**
 * Nombres de los rivales, por categoría.
 *
 * Cada carrera coge nombres al azar del bote de su categoría y los reparte
 * sobre tiempos barajados, así que no gana siempre el mismo: el favorito
 * cambia en cada intento aunque los tiempos del rango sean los de siempre.
 *
 * Los botes son más grandes que el número de rivales a propósito. Con 7
 * corredores y 16 nombres casi nunca ves dos alineaciones iguales.
 */
const NAMES = {
  // Niños
  1: [
    'Dani', 'Hugo', 'Martín', 'Vega', 'Leo', 'Nico', 'Iker', 'Bruno',
    'Álvaro', 'Mateo', 'Pablo', 'Gael', 'Enzo', 'Adrián', 'Thiago', 'Lucas',
  ],

  // Physical Festival: son niñas
  2: [
    'Lucía', 'Martina', 'Sofía', 'Emma', 'Julia', 'Carla', 'Alba', 'Daniela',
    'Valeria', 'Noa', 'Chloe', 'Aitana', 'Olivia', 'Candela', 'Jimena', 'Vera',
  ],

  // Instituto
  3: [
    'Marcos R.', 'Ainhoa V.', 'Sergio D.', 'Nerea P.', 'Iván M.', 'Claudia S.',
    'Raúl T.', 'Paula G.', 'Óscar L.', 'Elena F.', 'Diego A.', 'Marta C.',
    'Jorge B.', 'Irene N.', 'Rubén Q.', 'Andrea H.',
  ],

  // Campeonato nacional
  4: [
    'A. Ferreiro', 'M. Castells', 'J. Olmedo', 'R. Cardenal', 'V. Bustamante',
    'D. Escalona', 'S. Puigcerdà', 'N. Aranguren', 'F. Belmonte', 'C. Quiroga',
    'L. Maldonado', 'T. Sanchís', 'E. Berrocal', 'H. Valcárcel',
  ],

  // Olimpiadas: la élite mundial
  5: [
    'K. Thompson', 'O. Adeyemi', 'R. Nakamura', 'B. Okonkwo', 'M. Petrov',
    'J. Baptiste', 'D. Mwangi', 'L. Carvalho', 'S. Kowalski', 'A. Haddad',
    'T. Van Dijk', 'P. Nkemelu', 'G. Rossellini', 'W. Broderick',
  ],

  // Cyborg: ya no son personas
  6: [
    'UNIDAD-07', 'KX-4 RALLO', 'VÉRTEBRA-9', 'MK-II TALÓN', 'NEXO-33',
    'PROTOTIPO-Z', 'SIERRA-12', 'ORION-5B', 'CROMO-44', 'HÉLICE-08',
    'PULSO-19', 'ÍNDICE-6', 'ARCO-71', 'FILO-02',
  ],

  // Galaxy Athletes Meet: marcianos
  7: [
    "Zx'toq", 'Vrenna', "Ith'kar", 'Quollo', 'Xemenar', "Ssur'ha", 'Blimbo',
    'Nyx-Ra', "Ohm'vek", 'Trellidan', 'Yggzor', "Ka'lantis", 'Perrenqui', 'Vondu',
  ],

  // God Velocity: solo hay uno
  8: ['GOD VELOCITY'],

  // Yourself
  9: ['TU FANTASMA'],

  // Los dos de verdad. El bote tiene justo dos nombres, así que salen siempre
  // los dos; lo que sí cambia es cuál de ellos lleva el mejor tiempo.
  10: ['NACHO', 'JUANPA'],
};

const FALLBACK_NAMES = NAMES[4];

/** Baraja una copia. Fisher-Yates: cada orden sale con la misma probabilidad. */
function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * `count` nombres distintos de la categoría, en orden aleatorio.
 * Si se piden más de los que hay, repite pero numerando para no confundir.
 */
function pickNames(levelId, count) {
  const pool = NAMES[levelId] ?? FALLBACK_NAMES;
  const picked = shuffled(pool).slice(0, count);
  while (picked.length < count) {
    picked.push(`${pool[picked.length % pool.length]} II`);
  }
  return picked;
}

export { NAMES, pickNames, shuffled };
