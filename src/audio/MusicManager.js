/**
 * Un tema por categoría.
 *
 * Los archivos van en `public/music/` y el juego los busca por nombre:
 *
 *   public/music/menu.mp3   menú principal
 *   public/music/1.mp3      Niños
 *   public/music/2.mp3      Physical Festival
 *   ...                     (hasta 9.mp3, Yourself)
 *   public/music/0.mp3      contrarreloj  — opcional
 *
 * Vite copia `public/` tal cual, así que la ruta `/music/3.mp3` vale igual en
 * desarrollo que en el build. Si un archivo no está, ese nivel corre en
 * silencio y no pasa nada más: no hay que tenerlos todos para jugar.
 *
 * Se usa <audio> y no la Web Audio API a propósito: el navegador lo va
 * descargando mientras suena, en vez de tener que decodificar varios megas
 * antes de empezar. El precio es un microcorte al enlazar el bucle, que en
 * música de fondo no se nota.
 */

const BASE = 'music';
// Se prueban por orden hasta que una cargue, así da igual en qué formato
// grabes: m4a (AAC) y mp3 los abren todos los navegadores, ogg no lo abre
// Safari. No hay que convertir nada.
const EXTENSIONS = ['m4a', 'mp3', 'ogg'];
const VOLUME = 0.45;
const FADE = 0.6;         // s de cruce entre temas
const FADE_STEP = 0.05;   // s entre pasos del cruce

/** Temas sin ningún archivo. Evita reintentar descargas que ya fallaron. */
const missing = new Set();

class MusicManager {
  constructor() {
    this.current = null;    // { audio, track }
    this.track = null;      // identificador pedido, aunque aún no suene
    this.muted = false;
    this.allowed = false;   // hasta la primera interacción el navegador no deja
  }

  /**
   * Autoriza la reproducción. Los navegadores bloquean el audio hasta que el
   * usuario toca algo, así que main.js llama a esto desde la primera tecla.
   */
  unlock() {
    if (this.allowed) return;
    this.allowed = true;
    if (this.track !== null) this.play(this.track, true);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.current) return;
    if (muted) this.current.audio.pause();
    else this.current.audio.play().catch(() => {});
  }

  /**
   * @param {string|number} track 'menu' o el id de la categoría
   * @param {boolean} force repite el arranque aunque ya sea el tema actual
   */
  play(track, force = false) {
    if (this.track === track && !force) return;
    this.track = track;

    if (!this.allowed || missing.has(track)) return;
    if (this.current?.track === track) return;

    this.fadeOut(this.current?.audio);
    this.current = null;
    this.load(track, 0);
  }

  /**
   * Intenta una extensión. Si el archivo no está, prueba la siguiente; cuando
   * se acaban, ese tema se queda sin música y no se vuelve a pedir.
   */
  load(track, extIndex) {
    if (extIndex >= EXTENSIONS.length) {
      missing.add(track);
      return;
    }

    const audio = new Audio(`${BASE}/${track}.${EXTENSIONS[extIndex]}`);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';

    audio.addEventListener('error', () => {
      if (this.current?.audio !== audio) return;
      this.current = null;
      if (this.track === track) this.load(track, extIndex + 1);
    });

    const started = audio.play();
    if (started) {
      started.catch(() => {
        // El navegador aún no lo permite: se reintenta en el próximo unlock
        this.allowed = false;
      });
    }

    this.current = { audio, track };
    if (!this.muted) this.fadeIn(audio);
  }

  stop() {
    this.track = null;
    this.fadeOut(this.current?.audio);
    this.current = null;
  }

  fadeIn(audio) {
    this.ramp(audio, VOLUME, () => {});
  }

  fadeOut(audio) {
    if (!audio) return;
    this.ramp(audio, 0, () => audio.pause());
  }

  /** Rampa de volumen a pasos. `<audio>` no tiene automatización propia. */
  ramp(audio, target, done) {
    const from = audio.volume;
    const steps = Math.max(Math.round(FADE / FADE_STEP), 1);
    let i = 0;

    clearInterval(audio._ramp);
    audio._ramp = setInterval(() => {
      i++;
      const k = Math.min(i / steps, 1);
      audio.volume = Math.min(Math.max(from + (target - from) * k, 0), 1);
      if (k >= 1) {
        clearInterval(audio._ramp);
        done();
      }
    }, FADE_STEP * 1000);
  }
}

export { MusicManager };
