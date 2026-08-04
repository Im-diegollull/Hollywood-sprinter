import { Track, PLAYER_LANE, PPM } from './Track.js';

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

const STRIDE_LENGTH = 2.0;   // metros por zancada completa

// Dirección de avance en pantalla, normalizada. La usan las piernas y los
// brazos para balancearse a lo largo de la pista y no en horizontal.
const DIR = (() => {
  const x = 1;
  const y = -0.22;
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
})();

const COLORS = {
  text: '#e8eef3',
  textDim: '#8ea0b2',
  accent: '#ffd166',
  panel: 'rgba(13, 17, 22, 0.78)',
  skin: '#c98a5b',
  singlet: '#ffd166',
  shorts: '#1d3a8f',
  shoes: '#e8eef3',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

/**
 * Dibujo en canvas. Único sitio del proyecto que convierte metros a píxeles.
 */
class Renderer {
  constructor(canvas, raceDistance) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = new Track(raceDistance);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(
      window.innerWidth / VIEW_WIDTH,
      window.innerHeight / VIEW_HEIGHT
    );
    this.canvas.width = Math.round(VIEW_WIDTH * fit * dpr);
    this.canvas.height = Math.round(VIEW_HEIGHT * fit * dpr);
    this.canvas.style.width = `${VIEW_WIDTH * fit}px`;
    this.canvas.style.height = `${VIEW_HEIGHT * fit}px`;
    this.ctx.setTransform(fit * dpr, 0, 0, fit * dpr, 0, 0);
  }

  draw(race, stats) {
    const runner = race.runner;

    this.track.follow(runner.distance, PLAYER_LANE);
    this.track.draw(this.ctx, VIEW_WIDTH, VIEW_HEIGHT);

    const feet = this.track.project(runner.distance, PLAYER_LANE + 0.5);
    this.drawRunner(feet, runner.distance, runner.speed);

    this.drawHUD(race, stats);
  }

  /**
   * Corredor de espaldas. Geometría provisional: la animación por sprites
   * llega en la semana 7-8, pero el ciclo ya va atado a la distancia.
   */
  drawRunner({ x, y }, distance, speed) {
    const { ctx } = this;
    const h = 34;
    const phase = (distance / STRIDE_LENGTH) * Math.PI * 2;
    const effort = Math.min(speed / 8, 1);
    const bob = Math.abs(Math.sin(phase)) * 3 * effort;

    const hipY = y - h * 0.42 - bob;
    const shoulderY = y - h * 0.78 - bob;

    ctx.save();

    // sombra
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, 9, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // piernas
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    for (const side of [0, 1]) {
      const p = phase + side * Math.PI;
      const swing = Math.sin(p) * 8.5 * effort;
      const lift = Math.max(0, Math.sin(p)) * 5.5 * effort;
      const hipX = x + (side === 0 ? -2.5 : 2.5);
      const footX = hipX + DIR.x * swing;
      const footY = y + DIR.y * swing - lift;

      ctx.strokeStyle = COLORS.skin;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      ctx.fillStyle = COLORS.shoes;
      ctx.beginPath();
      ctx.ellipse(footX, footY, 2.8, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // brazos, en contrafase con las piernas
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.skin;
    for (const side of [0, 1]) {
      const p = phase + Math.PI + side * Math.PI;
      const swing = Math.sin(p) * 7 * effort;
      const shoulderX = x + (side === 0 ? -5.5 : 5.5);
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY + 2);
      ctx.lineTo(shoulderX + DIR.x * swing, shoulderY + 10 + DIR.y * swing);
      ctx.stroke();
    }

    // pantalón y camiseta
    ctx.fillStyle = COLORS.shorts;
    ctx.fillRect(x - 5.5, hipY - 6, 11, 8);
    ctx.fillStyle = COLORS.singlet;
    ctx.fillRect(x - 5.5, shoulderY, 11, h * 0.38);

    // cabeza
    ctx.fillStyle = COLORS.skin;
    ctx.beginPath();
    ctx.arc(x, shoulderY - 4.6, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(x, shoulderY - 5.8, 4.3, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawHUD(race, stats) {
    const { ctx } = this;
    const runner = race.runner;

    const fade = ctx.createLinearGradient(0, 0, 0, 110);
    fade.addColorStop(0, 'rgba(10, 14, 18, 0.85)');
    fade.addColorStop(1, 'rgba(10, 14, 18, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, VIEW_WIDTH, 110);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 42px ui-monospace, monospace';
    ctx.fillText(race.time.toFixed(2), 28, 56);

    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('TIEMPO', 28, 76);

    const cols = [
      ['DISTANCIA', `${runner.distance.toFixed(1)} m`],
      ['VELOCIDAD', `${runner.speed.toFixed(2)} m/s`],
      ['CADENCIA', `${runner.cadence.toFixed(1)} /s`],
      ['PULSACIONES', `${runner.strokes}`],
    ];
    cols.forEach(([label, value], i) => {
      const x = 190 + i * 150;
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 18px ui-monospace, monospace';
      ctx.fillText(value, x, 52);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(label, x, 72);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('MEJOR TIEMPO', VIEW_WIDTH - 28, 72);
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.fillText(stats.best ? `${stats.best.toFixed(2)} s` : '—', VIEW_WIDTH - 28, 52);

    ctx.textAlign = 'center';
    if (race.state === 'idle') {
      this.drawBanner('ALTERNA ← →  PARA CORRER', 'Cualquier pulsación arranca el crono');
    } else if (race.isFinished) {
      const label = stats.isRecord ? '¡RÉCORD!' : `${race.time.toFixed(2)} s`;
      this.drawBanner(label, 'R para repetir  ·  F2 para calibrar');
    }
  }

  drawBanner(title, subtitle) {
    const { ctx } = this;
    ctx.font = 'bold 30px ui-monospace, monospace';
    const width = Math.max(ctx.measureText(title).width + 80, 420);
    const x = (VIEW_WIDTH - width) / 2;

    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(x, 396, width, 84, 10);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.fillText(title, VIEW_WIDTH / 2, 434);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(subtitle, VIEW_WIDTH / 2, 460);
  }
}

export { Renderer, VIEW_WIDTH, VIEW_HEIGHT, PPM };
