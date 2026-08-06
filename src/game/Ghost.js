import { TUNING } from './Physics.js';

/**
 * Nivel 9 — Yourself. El rival es la repetición de tu mejor carrera de
 * God Velocity, así que es el único que sí acelera: eres tú.
 *
 * Las muestras llegan en un array plano [t0, x0, t1, x1, ...] para que ocupen
 * la mitad en localStorage que un array de objetos.
 */
class Ghost {
  isGhost = true;   // el renderer lo dibuja translúcido

  constructor(samples, totalTime, lane, name = 'TU FANTASMA') {
    this.samples = samples;
    this.totalTime = totalTime;
    this.lane = lane;
    this.name = name;
    this.reset();
  }

  reset() {
    this.distance = 0;
    this.speed = 0;
    this.cursor = 0;
    this.finished = false;
    this.finishTime = null;
  }

  get expectedTime() {
    return this.totalTime;
  }

  /** Como los rivales, tras la meta sigue de largo aflojando poco a poco. */
  update(dt, time, raceDistance) {
    if (this.finished) {
      this.speed = Math.max(this.speed - TUNING.RUNOUT_DECEL * dt, 0);
      this.distance += this.speed * dt;
      return;
    }

    const previous = this.distance;
    this.distance = this.distanceAt(time);
    this.speed = dt > 0 ? (this.distance - previous) / dt : this.speed;

    if (this.distance >= raceDistance || time >= this.totalTime) {
      this.finished = true;
      this.finishTime = this.totalTime;
    }
  }

  /**
   * Interpola entre las dos muestras que rodean a `time`. El cursor avanza
   * en vez de buscar desde el principio porque el tiempo solo va hacia
   * delante; si se reinicia la carrera, reset() lo devuelve a cero.
   */
  distanceAt(time) {
    const s = this.samples;
    const last = s.length - 2;

    while (this.cursor < last - 1 && s[this.cursor + 2] <= time) {
      this.cursor += 2;
    }

    const t0 = s[this.cursor];
    const x0 = s[this.cursor + 1];
    if (this.cursor >= last) return x0;

    const t1 = s[this.cursor + 2];
    const x1 = s[this.cursor + 3];
    if (time <= t0) return x0;

    const span = t1 - t0;
    const k = span > 0 ? (time - t0) / span : 0;
    return x0 + (x1 - x0) * k;
  }
}

export { Ghost };
