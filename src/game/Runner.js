import {
  smoothCadence,
  decayCadence,
  targetSpeedFor,
  approachSpeed,
} from './Physics.js';

/**
 * Corredor del jugador. Acelera desde cero según la cadencia de alternancia.
 * El tiempo llega siempre desde fuera, en segundos de carrera.
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
    this.finished = false;
    this.finishTime = null;
  }

  /**
   * Registra una pulsación. Solo cuenta si alterna respecto a la anterior.
   * @returns {boolean} true si la pulsación fue válida
   */
  press(key, time) {
    if (key === this.lastKey) return false;

    const gap = time - this.lastKeyTime;
    if (this.lastKey !== null) {
      this.cadence = smoothCadence(this.cadence, gap);
    }

    this.lastKey = key;
    this.lastKeyTime = time;
    this.strokes++;
    return true;
  }

  update(dt, time) {
    if (this.finished) return;

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

export { Runner };
