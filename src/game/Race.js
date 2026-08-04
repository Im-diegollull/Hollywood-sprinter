import { Runner } from './Runner.js';
import { Rival } from './Rival.js';
import { generateRivalTimes } from '../data/levels.js';

const RACE_DISTANCE = 100; // metros
const LANE_COUNT = 8;
const PLAYER_LANE = 3;

const STATE = {
  IDLE: 'idle',
  SET: 'set',        // secuencia de salida
  RUNNING: 'running',
  FINISHED: 'finished',
};

// Sin falsa partida: pulsar durante la salida no penaliza, simplemente no cuenta.
const SET_PHASES = [
  { label: 'EN SUS MARCAS', duration: 1.3 },
  { label: 'LISTOS', duration: 1.0, jitter: 0.9 },
  { label: '¡YA!', duration: 0.6 },
];

/**
 * Estado de una carrera de 100 m lisos contra los rivales de una categoría.
 */
class Race {
  constructor(level, bestTime = null) {
    this.distance = RACE_DISTANCE;
    this.runner = new Runner(PLAYER_LANE);
    this.setLevel(level, bestTime);
  }

  setLevel(level, bestTime = null) {
    this.level = level;
    const times = generateRivalTimes(level, bestTime);
    const lanes = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (lane !== PLAYER_LANE) lanes.push(lane);
    }

    this.rivals = times.map((time, i) => new Rival(time, lanes[i % lanes.length], `Carril ${lanes[i % lanes.length] + 1}`));
    this.reset();
  }

  reset() {
    this.state = STATE.IDLE;
    this.time = 0;
    this.setTimer = 0;
    // El "listos" dura un poco distinto cada vez para que no se pueda memorizar
    this.readyExtra = Math.random() * (SET_PHASES[1].jitter ?? 0);
    this.runner.reset();
    this.rivals.forEach((rival) => rival.reset());
    this.standings = null;
  }

  /** Arranca la secuencia de salida. */
  begin() {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.SET;
    this.setTimer = 0;
  }

  press(side) {
    if (this.state === STATE.IDLE) {
      this.begin();
      return;
    }
    if (this.state !== STATE.RUNNING) return; // antes del disparo no cuenta
    this.runner.press(side, this.time);
  }

  /** Fase actual de la salida, o null si la carrera no está en la salida. */
  get setPhase() {
    if (this.state !== STATE.SET) return null;

    let elapsed = this.setTimer;
    for (const phase of SET_PHASES) {
      const duration = phase.duration + (phase.jitter ? this.readyExtra : 0);
      if (elapsed < duration) return phase.label;
      elapsed -= duration;
    }
    return SET_PHASES[SET_PHASES.length - 1].label;
  }

  get gunTime() {
    return SET_PHASES[0].duration + SET_PHASES[1].duration + this.readyExtra;
  }

  update(dt) {
    if (this.state === STATE.SET) {
      this.setTimer += dt;
      if (this.setTimer >= this.gunTime) {
        this.state = STATE.RUNNING;
        this.time = 0;
        this.runner.lastKeyTime = 0;
      }
      return;
    }

    if (this.state !== STATE.RUNNING) return;

    this.time += dt;
    this.runner.update(dt, this.time);
    this.rivals.forEach((rival) => rival.update(dt, this.time, this.distance));

    if (this.runner.distance >= this.distance) {
      this.runner.finish(this.distance, this.time);
      this.time = this.runner.finishTime;
      this.state = STATE.FINISHED;
      this.standings = this.buildStandings();
    }
  }

  /**
   * Clasificación final. Los rivales van a velocidad constante, así que su
   * tiempo de llegada se conoce de antemano: no hace falta seguir simulando.
   */
  buildStandings() {
    const entries = [
      { name: 'TÚ', time: this.runner.finishTime, lane: this.runner.lane, isPlayer: true },
      ...this.rivals.map((rival) => ({
        name: rival.name,
        time: this.distance / rival.speed,
        lane: rival.lane,
        isPlayer: false,
      })),
    ];
    entries.sort((a, b) => a.time - b.time);
    entries.forEach((entry, i) => { entry.position = i + 1; });
    return entries;
  }

  /** Posición del jugador ahora mismo, 1 = primero. */
  get livePosition() {
    let ahead = 0;
    for (const rival of this.rivals) {
      if (rival.distance > this.runner.distance) ahead++;
    }
    return ahead + 1;
  }

  get fieldSize() {
    return this.rivals.length + 1;
  }

  get playerPosition() {
    return this.standings?.find((entry) => entry.isPlayer)?.position ?? null;
  }

  get won() {
    return this.playerPosition === 1;
  }

  get isRunning() {
    return this.state === STATE.RUNNING;
  }

  get isFinished() {
    return this.state === STATE.FINISHED;
  }
}

export { Race, STATE, RACE_DISTANCE, LANE_COUNT, PLAYER_LANE };
