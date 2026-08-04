// Modelo de cadencia/velocidad del jugador.
// Toda la lógica trabaja en metros y segundos. Nunca en píxeles.

// Constantes de calibración. Se ajustan en playtest desde el panel [D].
const DEFAULT_TUNING = {
  // Sin tope de velocidad: el único límite es lo rápido que puedas alternar.
  // Con 1.4, batir a God Velocity (7.50 s) exige ~11.3 pulsaciones/s sostenidas.
  SPEED_PER_CADENCE: 1.4,   // m/s por pulsación/segundo
  DECAY_RATE: 8.0,          // m/s² — desaceleración al dejar de pulsar
  CADENCE_SMOOTHING: 0.15,  // 0-1, cuánto pesa cada pulsación nueva
  CADENCE_DECAY: 2.2,       // 1/s — caída exponencial de la cadencia en pausa
  CADENCE_IDLE_GRACE: 0.3,  // s sin pulsar antes de empezar a perder cadencia
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
 * Cadencia (pulsaciones/s) suavizada tras una pulsación válida.
 *
 * El hueco se limita por abajo a MIN_KEY_GAP. Sin ese tope, dos teclas
 * separadas por milisegundos daban cadencias de 300/s y disparaban la
 * velocidad; era posible hacer 100 m en menos de 5 s aporreando las dos
 * teclas cuatro veces por segundo.
 */
function smoothCadence(cadence, gap) {
  if (gap <= 0 || gap >= TUNING.MAX_KEY_GAP) return cadence;
  const instant = 1 / Math.max(gap, TUNING.MIN_KEY_GAP);
  return cadence + (instant - cadence) * TUNING.CADENCE_SMOOTHING;
}

/** Caída de cadencia cuando no se pulsa. Independiente del framerate. */
function decayCadence(cadence, timeSinceKey, dt) {
  if (timeSinceKey <= TUNING.CADENCE_IDLE_GRACE) return cadence;
  return cadence * Math.exp(-TUNING.CADENCE_DECAY * dt);
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
  smoothCadence,
  decayCadence,
  targetSpeedFor,
  approachSpeed,
};
