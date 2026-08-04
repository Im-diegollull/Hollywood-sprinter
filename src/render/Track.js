/**
 * Pista en perspectiva diagonal, como el Sprinter original.
 *
 * El mundo se define en (x = metros recorridos, lane = carril) y se proyecta
 * a pantalla con una matriz afín, así que se dibuja en metros y carriles y
 * nunca en píxeles.
 *
 * Los dos ángulos están medidos sobre una captura del juego original a
 * pantalla completa: las líneas de carril bajan hacia la derecha con
 * pendiente 0.20, y la línea de salida —la diagonal que forman los ocho
 * corredores— sube con pendiente 0.35. Las dos salen de la misma proyección:
 * guiñada de 37° y eje vertical aplastado a 0.26, o sea una cámara bastante
 * baja sobre la pista.
 */

const LANES = 8;
const PLAYER_LANE = 3;

const YAW = (37.1 * Math.PI) / 180;
const PITCH_SQUASH = 0.2646;  // cuánto se aplasta el eje que se aleja
const LANE_WIDTH = 1.22;      // metros, medida oficial de atletismo
// El original está más cerca todavía (unos 122), pero a esa distancia apenas
// caben 8 m de pista y los rivales desaparecen en cuanto te sacan ventaja.
// Con 84 caben 8.4 m fijos, que el adelanto de cámara estira hasta 13.4
// cuando hay alguien por delante (ver lookAhead en Renderer). Medido: la
// ventaja máxima del líder jugando a ritmo competitivo son 5-9 m.
const SCALE = 84;             // px por metro. Subirlo acerca la cámara

// Matriz de proyección: (metros, carriles) -> píxeles
//
// El avance va hacia la IZQUIERDA de la pantalla, como en el original: se
// niega el eje de la pista dejando intacto el de los carriles. Las líneas
// siguen teniendo la misma pendiente (una recta no cambia al recorrerla al
// revés), así que el césped se queda abajo-izquierda y el cielo arriba-derecha;
// lo único que cambia es hacia dónde se corre.
const A = -SCALE * Math.cos(YAW);
const B = -SCALE * Math.sin(YAW) * PITCH_SQUASH;
const C = SCALE * LANE_WIDTH * Math.sin(YAW);
const D = -SCALE * LANE_WIDTH * Math.cos(YAW) * PITCH_SQUASH;

// Dónde se ancla el corredor. Va escorado a la derecha porque lo que hay
// por delante queda hacia la izquierda.
const PLAYER_SX = 560;
const PLAYER_SY = 360;

const DRAW_BEHIND = 30;   // metros de pista dibujados por detrás
const DRAW_AHEAD = 45;    // y por delante

// Muestreados de la captura del original
const COLORS = {
  sky: '#3f43c8',
  grass: '#1d7a1d',
  track: '#8e2f28',
  line: 'rgba(255, 218, 212, 0.72)',
  kerb: '#f4f1ea',
  paint: 'rgba(255, 236, 232, 0.85)',
  label: '#f4f1ea',
};

class Track {
  constructor(raceDistance) {
    this.raceDistance = raceDistance;
    this.e = 0;
    this.f = 0;
    this.focus = 0;
  }

  /** Ancla la cámara al corredor: siempre queda en el mismo punto de pantalla. */
  follow(distance, lane = PLAYER_LANE) {
    this.focus = distance;
    this.e = PLAYER_SX - A * distance - C * (lane + 0.5);
    this.f = PLAYER_SY - B * distance - D * (lane + 0.5);
  }

  project(x, lane) {
    return {
      x: A * x + C * lane + this.e,
      y: B * x + D * lane + this.f,
    };
  }

  /** Entra en coordenadas de pista. Hay que cerrar con ctx.restore(). */
  pushTransform(ctx) {
    ctx.save();
    ctx.transform(A, B, C, D, this.e, this.f);
  }

  /** @param {{labels?: boolean}} options el menú usa la pista sin numeración */
  draw(ctx, viewWidth, viewHeight, { labels = true } = {}) {
    const from = this.focus - DRAW_BEHIND;
    const span = DRAW_BEHIND + DRAW_AHEAD;

    // Cielo. En el original no hay graderío: por fuera del carril 8 solo azul.
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    this.pushTransform(ctx);

    // Césped interior, del lado del carril 1
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(from, -40, span, 40);

    // Tartán
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(from, 0, span, LANES);

    // Bordillo blanco entre césped y pista
    ctx.fillStyle = COLORS.kerb;
    ctx.fillRect(from, -0.16, span, 0.16);

    // Líneas de carril, finas y rosadas como en el original
    ctx.fillStyle = COLORS.line;
    for (let lane = 1; lane < LANES; lane++) {
      ctx.fillRect(from, lane - 0.025, span, 0.05);
    }
    ctx.fillRect(from, LANES - 0.03, span, 0.06);

    this.drawDistanceLines(ctx, from, span);
    ctx.restore();

    this.drawLaneNumbers(ctx, viewWidth, viewHeight);
    if (labels) this.drawLabels(ctx, viewWidth, viewHeight);
  }

  drawDistanceLines(ctx, from, span) {
    const to = from + span;

    ctx.fillStyle = COLORS.line;
    for (let m = Math.max(Math.ceil(from / 10) * 10, 0); m <= Math.min(to, this.raceDistance); m += 10) {
      if (m === 0 || m === this.raceDistance) continue;
      ctx.fillRect(m - 0.03, 0, 0.06, LANES);
    }

    // Salida y meta, gruesas y blancas
    ctx.fillStyle = COLORS.kerb;
    if (from < 0 && to > 0) ctx.fillRect(-0.14, 0, 0.28, LANES);
    if (to > this.raceDistance) {
      ctx.fillRect(this.raceDistance - 0.14, 0, 0.28, LANES);
      this.drawCheckers(ctx);
    }
  }

  drawCheckers(ctx) {
    const x = this.raceDistance;
    for (let lane = 0; lane < LANES; lane++) {
      for (let i = 0; i < 2; i++) {
        if ((lane + i) % 2 === 0) continue;
        ctx.fillStyle = '#1b1f24';
        ctx.fillRect(x + 0.16 + i * 0.4, lane, 0.4, 1);
      }
    }
  }

  /**
   * Números de carril pintados sobre el tartán, junto a la salida.
   * Se dibujan dentro de la transformación de pista para que salgan
   * deformados con la misma perspectiva, como pintura sobre el suelo.
   */
  drawLaneNumbers(ctx, viewWidth, viewHeight) {
    const at = -1.5; // metros antes de la salida: quedan detrás del corredor
    const anchor = this.project(at, LANES / 2);
    if (anchor.x < -300 || anchor.x > viewWidth + 300) return;

    for (let lane = 0; lane < LANES; lane++) {
      this.pushTransform(ctx);
      ctx.translate(at, lane + 0.5);   // centrado en su carril
      // Hay que invertir los dos ejes del texto: en coordenadas de pista la
      // X apunta a la izquierda de la pantalla (se corre hacia allí) y la Y
      // de los carriles apunta hacia arriba. Sin esto los números salen
      // espejados y del revés.
      ctx.scale(-0.042, -0.042);
      ctx.fillStyle = COLORS.paint;
      ctx.font = 'bold 18px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${lane + 1}`, 0, 0);
      ctx.restore();
    }
  }

  drawLabels(ctx, viewWidth, viewHeight) {
    const from = this.focus - DRAW_BEHIND;
    const to = this.focus + DRAW_AHEAD;

    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let m = Math.max(Math.ceil(from / 10) * 10, 0); m <= Math.min(to, this.raceDistance); m += 10) {
      if (m === 0) continue;
      const p = this.project(m, -1.1);   // sobre el césped, fuera del tartán
      if (p.x < -40 || p.x > viewWidth + 40 || p.y < -20 || p.y > viewHeight + 20) continue;
      ctx.fillStyle = COLORS.label;
      ctx.fillText(m === this.raceDistance ? 'META' : `${m}`, p.x, p.y);
    }

    ctx.textBaseline = 'alphabetic';
  }
}

/** Dirección de avance en pantalla, normalizada. La usan las extremidades. */
const FORWARD = (() => {
  const len = Math.hypot(A, B);
  return { x: A / len, y: B / len };
})();

/** Ancho de un carril en píxeles. Da la escala a la que dibujar corredores. */
const LANE_PITCH = Math.hypot(C, D);

export { Track, LANES, PLAYER_LANE, COLORS, FORWARD, LANE_PITCH };
