import { TUNING } from './Physics.js';

/**
 * Rival de velocidad constante.
 *
 * Arranca a su velocidad máxima desde el disparo, sin curva de aceleración.
 * Esto no es un simplificación: es exactamente cómo funciona el original y es
 * lo que hace que en los primeros metros siempre te saquen ventaja. Poner
 * aceleración aquí destruiría la remontada, que es la gracia del juego.
 */
class Rival {
  constructor(targetTime, lane, name) {
    this.targetTime = targetTime;
    this.speed = 100 / targetTime;
    this.lane = lane;
    this.name = name;
    this.reset();
  }

  reset() {
    this.distance = 0;
    this.finished = false;
    this.finishTime = null;
  }

  /** A velocidad constante el tiempo de llegada se sabe desde la salida. */
  get expectedTime() {
    return this.targetTime;
  }

  /**
   * Al cruzar la meta no se para: sigue de largo aflojando poco a poco.
   * Clavarlos en la línea se veía raro y no es lo que hace un velocista.
   */
  update(dt, time, raceDistance) {
    if (!this.finished && this.distance >= raceDistance) {
      this.finished = true;
      this.finishTime = this.targetTime;
    }
    if (this.finished) {
      this.speed = Math.max(this.speed - TUNING.RUNOUT_DECEL * dt, 0);
    }
    this.distance += this.speed * dt;
  }
}

export { Rival };
