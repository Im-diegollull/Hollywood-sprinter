/**
 * Efectos de sonido sintetizados con la Web Audio API.
 *
 * No hay ficheros de audio: el disparo, las pisadas y el público se generan
 * en el navegador. Así el juego no pesa más, carga instantáneo y no hay
 * licencias que atribuir. La música por categoría sí necesitará ficheros
 * (esos van en CREDITS.md).
 *
 * Nada suena hasta que el jugador toca una tecla: los navegadores bloquean
 * el audio sin interacción previa. De ahí unlock().
 */

const MASTER = 0.55;
const CROWD_EASE = 0.9;   // s de constante de tiempo del murmullo
const NOISE_SECONDS = 2;

/** Ruido blanco pregenerado. Es la base del disparo, las pisadas y el público. */
function buildNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

class SFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.crowdLevel = -1;
  }

  /** Se llama desde cualquier pulsación. Sin esto el navegador no deja sonar. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER;
    this.master.connect(this.ctx.destination);

    this.noise = buildNoise(this.ctx);
    this.buildCrowd();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /**
   * Murmullo del estadio: ruido filtrado en bucle. Dos capas, una grave para
   * el cuerpo y otra aguda para que no suene a viento.
   */
  buildCrowd() {
    const { ctx } = this;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0;
    this.crowd.connect(this.master);

    const layer = (freq, q, gain, type) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const level = ctx.createGain();
      level.gain.value = gain;
      src.connect(filter);
      filter.connect(level);
      level.connect(this.crowd);
      src.start();
    };

    layer(520, 0.7, 0.9, 'lowpass');
    layer(2400, 1.2, 0.22, 'bandpass');
  }

  /** @param {number} level 0-1, cuánto ruge el público ahora mismo */
  setCrowd(level) {
    if (!this.ctx) return;
    if (Math.abs(level - this.crowdLevel) < 0.02) return;
    this.crowdLevel = level;
    this.crowd.gain.setTargetAtTime(level * 0.32, this.ctx.currentTime, CROWD_EASE);
  }

  /** Subidón corto del público por encima de su nivel actual. */
  cheer(peak = 0.34, hold = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gain = this.crowd.gain;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(peak, t + 0.12);
    gain.setValueAtTime(peak, t + hold);
    gain.setTargetAtTime(Math.max(this.crowdLevel, 0) * 0.32, t + hold, 1.2);
  }

  /** Golpe de ruido con envolvente percusiva. */
  burst({ gain, decay, type = 'bandpass', freq = 1500, q = 1 }) {
    const { ctx } = this;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    // Arranca en un punto al azar del buffer para que no se repita el patrón
    src.start(t, Math.random() * (NOISE_SECONDS - decay - 0.1));
    src.stop(t + decay + 0.02);
  }

  /** Tono con caída exponencial. `slideTo` hace el barrido de un impacto. */
  tone({ freq, gain, decay, type = 'sine', slideTo = null, delay = 0 }) {
    const { ctx } = this;
    const t = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + decay);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  /** Disparo de salida: chasquido seco, golpe grave y el eco del estadio. */
  gun() {
    if (!this.ctx) return;
    this.burst({ gain: 0.85, decay: 0.16, type: 'highpass', freq: 1100 });
    this.tone({ freq: 140, slideTo: 45, gain: 0.6, decay: 0.18 });
    this.burst({ gain: 0.16, decay: 0.7, type: 'lowpass', freq: 700 });
    this.cheer(0.3, 0.8);
  }

  /** Voz del juez en "en sus marcas" y "listos". El "¡ya!" es el disparo. */
  call() {
    if (!this.ctx) return;
    this.tone({ freq: 392, gain: 0.12, decay: 0.28, type: 'triangle' });
  }

  /**
   * Pisada. Se dispara desde el ciclo de zancada, así que va sincronizada
   * con la animación por construcción.
   * @param {number} effort 0-1, cuánto se clava el pie
   */
  step(effort = 0.5) {
    if (!this.ctx) return;
    this.burst({
      gain: 0.05 + 0.08 * effort,
      decay: 0.05 + 0.03 * effort,
      freq: 1300 + Math.random() * 700,
      q: 0.9,
    });
    this.tone({ freq: 95, slideTo: 55, gain: 0.05 + 0.05 * effort, decay: 0.07 });
  }

  /** Caída por pulsar las dos teclas: golpe sordo contra el tartán. */
  stumble() {
    if (!this.ctx) return;
    this.tone({ freq: 90, slideTo: 38, gain: 0.7, decay: 0.3 });
    this.burst({ gain: 0.45, decay: 0.4, type: 'lowpass', freq: 420 });
  }

  /** Cruce de meta. */
  finish(won) {
    if (!this.ctx) return;
    this.cheer(won ? 0.42 : 0.26, won ? 1.6 : 0.7);
    if (!won) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone({ freq, gain: 0.16, decay: 0.5, type: 'triangle', delay: i * 0.09 });
    });
  }
}

export { SFX };
