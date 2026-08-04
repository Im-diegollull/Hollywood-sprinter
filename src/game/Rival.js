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

  update(dt, time, raceDistance) {
    if (this.finished) return;

    this.distance += this.speed * dt;

    if (this.distance >= raceDistance) {
      this.distance = raceDistance;
      this.finished = true;
      this.finishTime = raceDistance / this.speed;
    }
  }
}

export { Rival };
