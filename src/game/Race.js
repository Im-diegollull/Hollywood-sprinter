
import { Runner } from './Runner.js';

const RACE_DISTANCE = 100; // metros

const STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  FINISHED: 'finished',
};

/**
 * Estado de una carrera de 100 m lisos.
 * Semana 1-2: solo cronómetro y llegada. La secuencia de salida y la falsa
 * partida entran en la semana 3-4.
 */
class Race {
  constructor(distance = RACE_DISTANCE) {
    this.distance = distance;
    this.runner = new Runner();
    this.reset();
  }

  reset() {
    this.state = STATE.IDLE;
    this.time = 0;
    this.runner.reset();
  }

  start() {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.RUNNING;
    this.time = 0;
    this.runner.lastKeyTime = 0;
  }

  press(side) {
    if (this.state === STATE.IDLE) this.start();
    if (this.state !== STATE.RUNNING) return;
    this.runner.press(side, this.time);
  }

  update(dt) {
    if (this.state !== STATE.RUNNING) return;

    this.time += dt;
    this.runner.update(dt, this.time);

    if (this.runner.distance >= this.distance) {
      this.runner.finish(this.distance, this.time);
      this.time = this.runner.finishTime;
      this.state = STATE.FINISHED;
    }
  }

  get isRunning() {
    return this.state === STATE.RUNNING;
  }

  get isFinished() {
    return this.state === STATE.FINISHED;
  }
}

export { Race, STATE, RACE_DISTANCE };
