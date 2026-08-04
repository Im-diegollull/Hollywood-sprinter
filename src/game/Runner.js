import {
  TUNING,
  smoothCadence,
  decayCadence,
  targetSpeedFor,
  approachSpeed,
} from './Physics.js';

const PRESS = {
  OK: 'ok',
  SAME_KEY: 'same-key',
  STUMBLE: 'stumble',
  BLOCKED: 'blocked',
};

/**
 * Corredor del jugador. Acelera desde cero según la cadencia de alternancia.
 *
 * El tiempo llega siempre desde fuera y viene del reloj real, no del
 * cronómetro de carrera: los eventos de teclado ocurren entre frames, y
 * sellarlos con el tiempo del último frame falseaba los huecos.
 */
class Runner {
  constructor(lane = 0) {
    this.lane = lane;
    this.reset();
  }

  reset() {
    this.distance = 0;
    this.speed = 0;
    this.cadence = 0;
    this.lastKey = null;
    this.lastKeyTime = 0;
    this.strokes = 0;
    this.stumbles = 0;
    this.fallTimer = 0;
    this.finished = false;
    this.finishTime = null;
  }

  get fallen() {
    return this.fallTimer > 0;
  }

  /**
   * Registra una pulsación. Solo cuenta si alterna respecto a la anterior.
   * @returns {string} uno de PRESS
   */
  press(key, time) {
    if (this.fallen) return PRESS.BLOCKED;
    if (key === this.lastKey) return PRESS.SAME_KEY;

    const gap = time - this.lastKeyTime;

    // Las dos teclas a la vez: se tropieza y se va al suelo
    if (this.lastKey !== null && gap < TUNING.STUMBLE_GAP) {
      this.fall(time);
      return PRESS.STUMBLE;
    }

    if (this.lastKey !== null) {
      this.cadence = smoothCadence(this.cadence, gap);
    }

    this.lastKey = key;
    this.lastKeyTime = time;
    this.strokes++;
    return PRESS.OK;
  }

  fall(time) {
    this.fallTimer = TUNING.FALL_DURATION;
    this.cadence = 0;
    this.lastKey = null;
    this.lastKeyTime = time;
    this.stumbles++;
  }

  update(dt, time) {
    if (this.finished) return;

    if (this.fallen) {
      this.fallTimer -= dt;
      this.cadence = 0;
      this.speed = Math.max(this.speed - TUNING.FALL_DECEL * dt, 0);
      this.distance += this.speed * dt;
      // al levantarse, el reloj de cadencia arranca de cero
      if (!this.fallen) this.lastKeyTime = time;
      return;
    }

    this.cadence = decayCadence(this.cadence, time - this.lastKeyTime, dt);
    this.targetSpeed = targetSpeedFor(this.cadence);
    this.speed = approachSpeed(this.speed, this.targetSpeed, dt);
    this.distance += this.speed * dt;
  }

  /** Marca la llegada interpolando el instante exacto de cruce de meta. */
  finish(raceDistance, time) {
    const overshoot = this.distance - raceDistance;
    const correction = this.speed > 0 ? overshoot / this.speed : 0;
    this.distance = raceDistance;
    this.finished = true;
    this.finishTime = time - correction;
  }
}

export { Runner, PRESS };
