/**
 * Pista en perspectiva diagonal, como el Sprinter original.
 *
 * El mundo se define en (x = metros recorridos, lane = carril). La proyección
 * a pantalla es una matriz afín: la pista avanza hacia la derecha subiendo, y
 * los carriles bajan hacia la derecha. Eso da el look isométrico del original
 * sin necesidad de 3D.
 */

const LANES = 8;
const PLAYER_LANE = 3;

// Matriz de proyección (metros/carriles -> píxeles)
const PPM = 22;           // px por metro a lo largo de la pista
const TRACK_RISE = -0.22; // px verticales por px avanzado
const LANE_H = 26;        // px verticales por carril
const LANE_SHEAR = 0.5;   // px horizontales por px vertical de carril

const A = PPM;
const B = PPM * TRACK_RISE;
const C = LANE_H * LANE_SHEAR;
const D = LANE_H;

// Dónde se ancla el corredor del jugador en pantalla
const PLAYER_SX = 330;
const PLAYER_SY = 300;

const DRAW_BEHIND = 40;   // metros de pista dibujados por detrás
const DRAW_AHEAD = 60;    // y por delante

const COLORS = {
  outside: '#2e4f9c',
  stands: '#22397a',
  standsEdge: '#e9eef7',
  grass: '#2f6b34',
  grassEdge: '#e9eef7',
  track: '#b8402f',
  trackDark: '#a63928',
  line: '#f2efe9',
  label: '#f2efe9',
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

  draw(ctx, viewWidth, viewHeight) {
    const from = this.focus - DRAW_BEHIND;
    const span = DRAW_BEHIND + DRAW_AHEAD;

    ctx.fillStyle = COLORS.outside;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    this.pushTransform(ctx);

    // Graderío al otro lado de la pista, con su franja exterior pegada al tartán
    ctx.fillStyle = COLORS.stands;
    ctx.fillRect(from, -30, span, 30);
    this.drawCrowd(ctx, from, span);
    ctx.fillStyle = COLORS.outside;
    ctx.fillRect(from, -1.1, span, 1.1);

    // Césped interior, sin hueco contra la pista
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(from, LANES, span, 30);

    // Pista
    ctx.fillStyle = COLORS.track;
    ctx.fillRect(from, 0, span, LANES);
    ctx.fillStyle = COLORS.trackDark;
    for (let lane = 1; lane < LANES; lane += 2) {
      ctx.fillRect(from, lane, span, 1);
    }

    // Líneas de carril
    ctx.fillStyle = COLORS.line;
    for (let lane = 0; lane <= LANES; lane++) {
      ctx.fillRect(from, lane - 0.04, span, 0.08);
    }

    this.drawDistanceLines(ctx, from, span);
    ctx.restore();

    this.drawLabels(ctx, viewWidth, viewHeight);
  }

  drawCrowd(ctx, from, span) {
    const step = 0.7;
    const start = Math.floor(from / step) * step;
    for (let x = start; x < from + span; x += step) {
      for (let row = 0; row < 5; row++) {
        // hash estable: la grada no parpadea al hacer scroll
        const h = Math.abs(Math.sin((x * 12.9898 + row * 78.233) * 43758.5453));
        const shade = 60 + Math.floor(h * 150);
        ctx.fillStyle = `rgb(${shade}, ${shade - 14}, ${shade + 25})`;
        ctx.fillRect(x + (row % 2) * 0.35, -1.9 - row * 0.85, 0.34, 0.4);
      }
    }
  }

  drawDistanceLines(ctx, from, span) {
    const to = from + span;

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = COLORS.line;
    for (let m = Math.max(Math.ceil(from / 10) * 10, 0); m <= Math.min(to, this.raceDistance); m += 10) {
      if (m === 0 || m === this.raceDistance) continue;
      ctx.fillRect(m - 0.05, 0, 0.1, LANES);
    }
    ctx.globalAlpha = 1;

    // Salida y meta
    ctx.fillStyle = COLORS.line;
    if (from < 0 && to > 0) ctx.fillRect(-0.12, 0, 0.24, LANES);
    if (to > this.raceDistance) {
      ctx.fillRect(this.raceDistance - 0.12, 0, 0.24, LANES);
      this.drawCheckers(ctx);
    }
  }

  drawCheckers(ctx) {
    const x = this.raceDistance;
    for (let lane = 0; lane < LANES; lane++) {
      for (let i = 0; i < 2; i++) {
        if ((lane + i) % 2 === 0) continue;
        ctx.fillStyle = '#1b1f24';
        ctx.fillRect(x + 0.12 + i * 0.35, lane, 0.35, 1);
      }
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
      const p = this.project(m, LANES + 1.1);
      if (p.x < -40 || p.x > viewWidth + 40 || p.y < -20 || p.y > viewHeight + 20) continue;
      ctx.fillStyle = COLORS.label;
      ctx.fillText(m === this.raceDistance ? 'META' : `${m}`, p.x, p.y);
    }

    ctx.textBaseline = 'alphabetic';
  }
}

export { Track, LANES, PLAYER_LANE, PPM };
