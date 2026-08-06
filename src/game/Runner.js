import {
  TUNING,
  smoothGap,
  cadenceFrom,
  targetSpeedFor,
  approachSpeed,
} from './Physics.js';

const PRESS = {
  OK: 'ok',
  SAME_KEY: 'same-key',
  TOO_SOON: 'too-soon',   // demasiado junta: no cuenta, pero tampoco tira
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
    this.avgGap = 0;      // media del hueco entre pulsaciones, en segundos
    this.lastKey = null;
    this.lastKeyTime = 0;
    this.strokes = 0;
    this.stumbles = 0;
    this.strikes = 0;         // pulsaciones demasiado juntas seguidas
    this.lastStrikeTime = -99;
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

    // Pulsación demasiado pegada a la anterior para ser una alternancia.
    //
    // No tira al suelo a la primera: se ignora sin más. Ignorarla ya mata el
    // truco de aporrear las dos teclas, porque lo que acaba contando es el
    // ritmo al que juntas los pares y no los milisegundos de dentro. El suelo
    // se reserva para quien insiste, que es de lo único que hay que
    // protegerse. Una pulsación sucia suelta jugando rápido no cuesta nada.
    if (this.lastKey !== null && gap < TUNING.STUMBLE_GAP) {
      if (time - this.lastStrikeTime > TUNING.STRIKE_WINDOW) this.strikes = 0;
      this.strikes++;
      this.lastStrikeTime = time;

      if (this.strikes >= TUNING.STRIKES_TO_FALL) {
        this.fall(time);
        return PRESS.STUMBLE;
      }
      return PRESS.TOO_SOON;
    }

    if (this.lastKey !== null) {
      this.avgGap = smoothGap(this.avgGap, gap);
    }

    this.lastKey = key;
    this.lastKeyTime = time;
    this.strokes++;
    return PRESS.OK;
  }

  fall(time) {
    this.fallTimer = TUNING.FALL_DURATION;
    this.cadence = 0;
    this.avgGap = 0;
    this.lastKey = null;
    this.lastKeyTime = time;
    this.strikes = 0;
    this.stumbles++;
  }

  update(dt, time) {
    // Ya ha cruzado: sigue corriendo y afloja, no se clava en la línea
    if (this.finished) {
      this.speed = Math.max(this.speed - TUNING.RUNOUT_DECEL * dt, 0);
      this.distance += this.speed * dt;
      return;
    }

    if (this.fallen) {
      this.fallTimer -= dt;
      this.cadence = 0;
      this.speed = Math.max(this.speed - TUNING.FALL_DECEL * dt, 0);
      this.distance += this.speed * dt;
      // al levantarse, el reloj de cadencia arranca de cero
      if (!this.fallen) this.lastKeyTime = time;
      return;
    }

    this.cadence = cadenceFrom(this.avgGap, time - this.lastKeyTime);
    this.targetSpeed = targetSpeedFor(this.cadence);
    this.speed = approachSpeed(this.speed, this.targetSpeed, dt);
    this.distance += this.speed * dt;
  }

  /**
   * Marca la llegada interpolando el instante exacto de cruce de meta.
   * La distancia NO se recorta a los 100 m: el corredor sigue adelante y solo
   * se congela el crono.
   */
  finish(raceDistance, time) {
    const overshoot = this.distance - raceDistance;
    const correction = this.speed > 0 ? overshoot / this.speed : 0;
    this.finished = true;
    this.finishTime = time - correction;
  }
}

export { Runner, PRESS };
