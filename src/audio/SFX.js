/**
 * Efectos de sonido sintetizados con la Web Audio API.
 *
 * Todo lo que suena es percusivo y dura décimas de segundo. NO hay ruido en
 * bucle: hubo un murmullo de público hecho con dos capas de ruido filtrado y
 * sonaba exactamente a viento, porque es así como se sintetiza el viento. Si
 * algún día vuelve el público, tiene que ser una grabación, no ruido rosa.
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
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.05);
    }
    return this.muted;
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

  /** Cruce de meta: acorde al alza si ganas, caída corta si no. */
  finish(won) {
    if (!this.ctx) return;
    const chord = won ? [523.25, 659.25, 783.99] : [392.0, 329.63];
    chord.forEach((freq, i) => {
      this.tone({ freq, gain: 0.16, decay: 0.5, type: 'triangle', delay: i * 0.09 });
    });
  }
}

export { SFX };
