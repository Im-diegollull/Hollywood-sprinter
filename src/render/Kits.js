/**
 * Aspecto de los corredores por categoría.
 *
 * En el original cada categoría tiene su propia gente: empiezas contra niños
 * y acabas contra dioses. Aquí cada nivel define color, tamaño y cabeza de
 * sus rivales; el jugador lleva siempre el mismo equipo para que puedas
 * encontrarte de un vistazo en la pista.
 *
 * `head` es lo que más los distingue de espaldas, que es como se ven:
 *   normal    media luna de pelo
 *   ponytail  coleta que ondea hacia atrás
 *   visor     banda metálica con luz
 *   antennae  calvo con dos antenas
 *   halo      aureola sobre la cabeza
 */

const PLAYER_KIT = {
  skin: '#f0c9a8',
  singlet: '#e0349b',
  shorts: '#2438c8',
  shoes: '#3ad13a',
  hair: '#2b2118',
  bib: 'rgba(20, 24, 30, 0.55)',
  head: 'normal',
  scale: 1,
};

/** Rellena lo que cada kit no diga con los valores del jugador. */
const kit = (spec) => ({ ...PLAYER_KIT, ...spec });

const KITS = {
  // Niños: bajitos, colores de chándal de colegio
  1: kit({
    scale: 0.74, skin: '#f7d2ab', singlet: '#ffd23f', shorts: '#2a6fdb',
    shoes: '#ff5f5f', hair: '#6b4423',
  }),

  // Physical Festival: son niñas, con coleta.
  // Violeta y no rosa: el rosa se confundía con la camiseta del jugador y
  // costaba encontrarse en la pista, que es justo lo que no puede pasar.
  2: kit({
    scale: 0.82, skin: '#f8d6b6', singlet: '#8b5cf6', shorts: '#f2f4f7',
    shoes: '#ff7ad1', hair: '#4a2d18', head: 'ponytail',
  }),

  // Instituto: adolescentes con los colores del equipo del centro
  3: kit({
    scale: 0.93, skin: '#e8b98d', singlet: '#f2f4f7', shorts: '#123a8c',
    shoes: '#e03131', hair: '#241a12',
  }),

  // Campeonato nacional: equipación de selección
  4: kit({
    scale: 1, skin: '#d9a678', singlet: '#e03131', shorts: '#f2f4f7',
    shoes: '#1b2733', hair: '#1c1410',
  }),

  // Olimpiadas: profesionales, con el oro por delante
  5: kit({
    scale: 1, skin: '#c98a5a', singlet: '#0f9d58', shorts: '#ffd23f',
    shoes: '#f2f4f7', hair: '#120d0a', bib: 'rgba(255, 209, 102, 0.85)',
  }),

  // Cyborg: piel metálica, visor y luz roja
  6: kit({
    scale: 1.04, skin: '#9aa7b4', singlet: '#2b3440', shorts: '#39424f',
    shoes: '#ff3b30', hair: '#4a5563', head: 'visor',
    glow: 'rgba(255, 59, 48, 0.5)', bib: '#ff3b30',
  }),

  // Galaxy: marcianos verdes con antenas
  7: kit({
    scale: 0.98, skin: '#63d67a', singlet: '#5b2bd6', shorts: '#1a1030',
    shoes: '#c9ff3b', hair: '#3ba85a', head: 'antennae',
    glow: 'rgba(143, 107, 255, 0.5)', bib: '#c9ff3b',
  }),

  // God Velocity: dorado y con aureola
  8: kit({
    scale: 1.1, skin: '#ffe4a0', singlet: '#fff6d8', shorts: '#e8c24a',
    shoes: '#fbfbfb', hair: '#fff0b8', head: 'halo',
    glow: 'rgba(255, 209, 102, 0.6)', bib: 'rgba(232, 194, 74, 0.9)',
  }),

  // Yourself: tu propio récord, translúcido
  9: kit({ alpha: 0.5, glow: 'rgba(224, 52, 155, 0.35)' }),

  // Nacho & Juanpa: cada uno lleva el suyo, ver NAMED_KITS
  10: kit({ scale: 1.02, skin: '#e8b98d', singlet: '#c62828', shorts: '#1f4fd8', shoes: '#ff4fa8' }),
};

/**
 * Equipaciones de atletas concretos, copiadas de sus fotos.
 *
 * Van por nombre y no por carril porque los nombres se sortean en cada
 * carrera: si fueran por carril, Nacho saldría unas veces de rojo y otras de
 * azul marino. La clave tiene que ser la persona.
 */
const NAMED_KITS = {
  // Selección de Chile: peto rojo, short azul, manguito azul en un brazo y
  // zapatillas fucsia
  NACHO: kit({
    scale: 1.02, skin: '#e8b98d', singlet: '#c62828', shorts: '#1f4fd8',
    shoes: '#ff4fa8', hair: '#3b2a1c', sleeve: '#2f6de0',
    bib: 'rgba(248, 250, 252, 0.92)',
  }),

  // Club: peto azul marino con la S blanca y short negro
  JUANPA: kit({
    scale: 1.02, skin: '#e0b183', singlet: '#1e2a4a', shorts: '#141821',
    shoes: '#e8eef3', hair: '#221812',
    bib: 'rgba(242, 244, 247, 0.95)',
  }),
};

/**
 * Si el nivel 9 no tiene replay guardado corre God Velocity de verdad, así que
 * no debe salir con pinta de fantasma.
 *
 * @param {string} [name] nombre del rival, por si tiene equipación propia
 */
function kitFor(level, isGhost, name) {
  if (name && NAMED_KITS[name]) return NAMED_KITS[name];
  if (level.ghost) return isGhost ? KITS[9] : KITS[8];
  return KITS[level.id] ?? KITS[4];
}

export { KITS, NAMED_KITS, PLAYER_KIT, kitFor };
