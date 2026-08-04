// Modelo de cadencia/velocidad del jugador.
// Toda la lógica trabaja en metros y segundos. Nunca en píxeles.

// Constantes de calibración. Se ajustan en playtest desde el panel [D].
const DEFAULT_TUNING = {
  // Sin tope de velocidad: el único límite es lo rápido que puedas alternar.
  // Calibrado para que 6 pulsaciones/s den 14.30 s. Con eso batir a God
  // Velocity (7.50 s) exige 12.8 puls/s sostenidas.
  SPEED_PER_CADENCE: 1.23,  // m/s por pulsación/segundo
  DECAY_RATE: 8.0,          // m/s² — desaceleración al dejar de pulsar
  GAP_SMOOTHING: 0.25,      // 0-1, cuánto pesa el hueco de cada pulsación
  ACCEL_START: 6.0,         // m/s² — fase de arranque (crea la desventaja inicial)
  ACCEL_MAIN: 10.0,         // m/s² — a partir de ACCEL_THRESHOLD
  ACCEL_THRESHOLD: 5.0,     // m/s — dónde termina la fase de arranque
  MAX_KEY_GAP: 1.0,         // s — un hueco mayor no cuenta como cadencia

  // Dos pulsaciones más juntas que esto son las dos teclas a la vez, no una
  // alternancia: el corredor tropieza. 25 ms equivalen a 40 pulsaciones/s.
  // Medido: alternando a 16 puls/s con ±50% de temblor el hueco más corto
  // fue de 32 ms, así que no salta con juego rápido pero sucio.
  STUMBLE_GAP: 0.025,       // s
  MIN_KEY_GAP: 0.05,        // s — techo de la cadencia instantánea (20/s)
  FALL_DURATION: 1.1,       // s tirado en el suelo sin poder hacer nada
  FALL_DECEL: 16.0,         // m/s² — frenazo al caer
};

const TUNING = { ...DEFAULT_TUNING };

function resetTuning() {
  Object.assign(TUNING, DEFAULT_TUNING);
}

/**
 * Media suavizada del hueco entre pulsaciones, en segundos.
 *
 * Se promedia el HUECO y no la cadencia. Promediar `1/hueco` está sesgado al
 * alza porque esa función es convexa: con huecos de 40 ms y 300 ms la media de
 * `1/hueco` da 11.2 puls/s cuando en realidad se pulsa a 5.9. Cualquier
 * irregularidad humana inflaba la velocidad, y pulsando despacio salían
 * tiempos de 7 s. Promediar el hueco y luego invertir da la cadencia real.
 */
function smoothGap(avgGap, gap) {
  const clamped = Math.min(Math.max(gap, TUNING.MIN_KEY_GAP), TUNING.MAX_KEY_GAP);
  if (avgGap <= 0) return clamped;
  return avgGap + (clamped - avgGap) * TUNING.GAP_SMOOTHING;
}

/**
 * Cadencia actual en pulsaciones por segundo.
 *
 * Si llevas más tiempo sin pulsar que tu propio ritmo, manda ese silencio: la
 * cadencia cae sola sin necesidad de una constante de decaimiento aparte.
 */
function cadenceFrom(avgGap, timeSinceKey) {
  if (avgGap <= 0) return 0;
  return 1 / Math.max(avgGap, timeSinceKey);
}

/** Velocidad a la que tiende el corredor con la cadencia actual. Sin techo. */
function targetSpeedFor(cadence) {
  return cadence * TUNING.SPEED_PER_CADENCE;
}

/** Integra la velocidad hacia targetSpeed respetando la fase de arranque. */
function approachSpeed(speed, targetSpeed, dt) {
  if (targetSpeed > speed) {
    const accel = speed < TUNING.ACCEL_THRESHOLD ? TUNING.ACCEL_START : TUNING.ACCEL_MAIN;
    return Math.min(speed + accel * dt, targetSpeed);
  }
  return Math.max(speed - TUNING.DECAY_RATE * dt, targetSpeed);
}

export {
  TUNING,
  DEFAULT_TUNING,
  resetTuning,
  smoothGap,
  cadenceFrom,
  targetSpeedFor,
  approachSpeed,
};
