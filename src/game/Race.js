import { Runner } from './Runner.js';
import { Rival } from './Rival.js';
import { Ghost } from './Ghost.js';
import { generateRivalTimes } from '../data/levels.js';

const RACE_DISTANCE = 100; // metros
const LANE_COUNT = 8;
const PLAYER_LANE = 3;
const SAMPLE_INTERVAL = 0.04; // s entre muestras del replay

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
  constructor(level, ghost = null) {
    this.distance = RACE_DISTANCE;
    this.runner = new Runner(PLAYER_LANE);
    this.setLevel(level, ghost);
  }

  /**
   * @param {object} level categoría de data/levels.js
   * @param {{samples: number[], time: number} | null} ghost replay guardado,
   *        solo lo usa el nivel 9
   */
  setLevel(level, ghost = null) {
    this.level = level;
    const lanes = [];
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (lane !== PLAYER_LANE) lanes.push(lane);
    }
    const ghostLane = PLAYER_LANE + 1;

    if (level.ghost && ghost) {
      this.rivals = [new Ghost(ghost.samples, ghost.time, ghostLane)];
    } else {
      // Sin replay guardado, el nivel 9 cae en God Velocity a ritmo constante
      const times = generateRivalTimes(level);
      this.rivals = times.map((time, i) => {
        const lane = level.ghost ? ghostLane : lanes[i % lanes.length];
        const name = level.ghost ? 'GOD VELOCITY' : `Carril ${lane + 1}`;
        return new Rival(time, lane, name);
      });
    }

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
    this.replay = [];       // [t0, x0, t1, x1, ...] para el fantasma
    this.nextSample = 0;
  }

  /** Arranca la secuencia de salida. */
  begin() {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.SET;
    this.setTimer = 0;
  }

  /**
   * @param {string} side 'left' | 'right'
   * @param {number} clock segundos de reloj real, no del cronómetro. Los
   *        eventos de teclado caen entre frames y el cronómetro solo avanza
   *        una vez por frame, así que usarlo falsearía los huecos.
   */
  press(side, clock) {
    if (this.state === STATE.IDLE) {
      this.begin();
      return;
    }
    if (this.state !== STATE.RUNNING) return; // antes del disparo no cuenta
    this.runner.press(side, clock);
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

  update(dt, clock) {
    if (this.state === STATE.SET) {
      this.setTimer += dt;
      if (this.setTimer >= this.gunTime) {
        this.state = STATE.RUNNING;
        this.time = 0;
        this.runner.lastKeyTime = clock;
      }
      return;
    }

    if (this.state !== STATE.RUNNING) return;

    this.time += dt;
    this.runner.update(dt, clock);
    this.rivals.forEach((rival) => rival.update(dt, this.time, this.distance));
    this.sampleReplay();

    if (this.runner.distance >= this.distance) {
      this.runner.finish(this.distance, this.time);
      this.time = this.runner.finishTime;
      this.replay.push(this.time, this.distance);
      this.state = STATE.FINISHED;
      this.standings = this.buildStandings();
    }
  }

  /** Graba la posición cada SAMPLE_INTERVAL para poder repetirla en el nivel 9. */
  sampleReplay() {
    if (this.time < this.nextSample) return;
    this.replay.push(this.time, this.runner.distance);
    this.nextSample = this.time + SAMPLE_INTERVAL;
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
        time: rival.expectedTime,
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
    return this.rivals.length > 0 && this.playerPosition === 1;
  }

  /** El contrarreloj no tiene rivales: no se gana ni se pierde, se cronometra. */
  get isTimeTrial() {
    return this.rivals.length === 0;
  }

  get isRunning() {
    return this.state === STATE.RUNNING;
  }

  get isFinished() {
    return this.state === STATE.FINISHED;
  }
}

export { Race, STATE, RACE_DISTANCE, LANE_COUNT, PLAYER_LANE };
