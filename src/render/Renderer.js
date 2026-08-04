import { Track, TRACK_DIR } from './Track.js';

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

const STRIDE_LENGTH = 2.0;   // metros por zancada completa

// Dirección de avance en pantalla, normalizada. La usan las piernas y los
// brazos para balancearse a lo largo de la pista y no en horizontal.
const DIR = (() => {
  const len = Math.hypot(TRACK_DIR.x, TRACK_DIR.y);
  return { x: TRACK_DIR.x / len, y: TRACK_DIR.y / len };
})();

const COLORS = {
  text: '#e8eef3',
  textDim: '#8ea0b2',
  accent: '#ffd166',
  panel: 'rgba(13, 17, 22, 0.82)',
  shoes: '#e8eef3',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

const PLAYER_KIT = { skin: '#c98a5b', singlet: '#ffd166', shorts: '#1d3a8f' };

// Un kit por carril, para distinguir a los rivales de un vistazo
const RIVAL_KITS = [
  { skin: '#8d5a3b', singlet: '#f2efe9', shorts: '#c0392b' },
  { skin: '#d9a271', singlet: '#f2efe9', shorts: '#2c3e70' },
  { skin: '#7a4a2e', singlet: '#dfe6ec', shorts: '#1e7a4d' },
  { skin: '#c98a5b', singlet: '#f2efe9', shorts: '#7b3fa0' },
  { skin: '#a06a42', singlet: '#e9eef7', shorts: '#b8651c' },
  { skin: '#e0b184', singlet: '#f2efe9', shorts: '#0f6f86' },
  { skin: '#6d4126', singlet: '#dfe6ec', shorts: '#8c1f3e' },
  { skin: '#b47c4f', singlet: '#eef3f8', shorts: '#3d4a55' },
];

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

    this.track.follow(runner.distance, runner.lane);
    this.track.draw(this.ctx, VIEW_WIDTH, VIEW_HEIGHT);

    // De carril exterior a interior: los interiores están más cerca de la
    // cámara, así que se dibujan los últimos para que tapen a los de detrás.
    const field = [
      { lane: runner.lane, distance: runner.distance, speed: runner.speed, kit: PLAYER_KIT },
      ...race.rivals.map((rival) => ({
        lane: rival.lane,
        distance: rival.distance,
        speed: rival.speed,
        kit: RIVAL_KITS[rival.lane % RIVAL_KITS.length],
      })),
    ].sort((a, b) => b.lane - a.lane);

    for (const entry of field) {
      const feet = this.track.project(entry.distance, entry.lane + 0.5);
      if (feet.x < -60 || feet.x > VIEW_WIDTH + 60) continue;
      this.drawRunner(feet, entry.distance, entry.speed, entry.kit);
    }

    this.drawHUD(race, stats);
  }

  /**
   * Menú principal y selector de categoría, sobre la pista como fondo.
   * @param {object} menu instancia de ui/Menu
   * @param {(levelId: number) => number|null} recordFor récord por categoría
   */
  drawMenu(menu, recordFor) {
    const { ctx } = this;

    this.track.follow(24, 3);
    this.track.draw(ctx, VIEW_WIDTH, VIEW_HEIGHT, { labels: false });

    ctx.fillStyle = 'rgba(10, 14, 18, 0.74)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 52px ui-monospace, monospace';
    ctx.fillText('SPRINTER', VIEW_WIDTH / 2, 96);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(
      menu.screen === 'main' ? 'Alterna ← → lo más rápido que puedas' : 'Gana una categoría para desbloquear la siguiente',
      VIEW_WIDTH / 2,
      120
    );

    const items = menu.items;
    const rowHeight = 38;
    const width = 520;
    const x = (VIEW_WIDTH - width) / 2;
    const top = 168;

    items.forEach((item, i) => {
      const y = top + i * rowHeight;
      const active = i === menu.index;
      const locked = Boolean(item.locked);

      if (active) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.14)';
        ctx.beginPath();
        ctx.roundRect(x, y - 22, width, 32, 6);
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? '#5c6b7a' : active ? COLORS.accent : COLORS.text;
      ctx.font = `${active ? 'bold ' : ''}17px ui-monospace, monospace`;
      ctx.fillText(`${active ? '▸ ' : '  '}${item.label}`, x + 18, y);

      ctx.textAlign = 'right';
      ctx.font = '13px ui-monospace, monospace';
      if (locked) {
        ctx.fillStyle = '#5c6b7a';
        ctx.fillText('BLOQUEADA', x + width - 18, y);
      } else if (item.level) {
        const record = recordFor(item.level.id);
        ctx.fillStyle = record ? COLORS.accent : COLORS.textDim;
        ctx.fillText(record ? `${record.toFixed(2)} s` : '—', x + width - 18, y);
      } else {
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(item.hint ?? '', x + width - 18, y);
      }
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      '↑ ↓ para elegir  ·  ENTER para empezar  ·  ESC para volver',
      VIEW_WIDTH / 2,
      VIEW_HEIGHT - 34
    );
  }

  /**
   * Corredor de espaldas. Geometría provisional: la animación por sprites
   * llega en la semana 7-8, pero el ciclo ya va atado a la distancia.
   */
  drawRunner({ x, y }, distance, speed, kit = PLAYER_KIT) {
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

      ctx.strokeStyle = kit.skin;
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
    ctx.strokeStyle = kit.skin;
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
    ctx.fillStyle = kit.shorts;
    ctx.fillRect(x - 5.5, hipY - 6, 11, 8);
    ctx.fillStyle = kit.singlet;
    ctx.fillRect(x - 5.5, shoulderY, 11, h * 0.38);

    // cabeza
    ctx.fillStyle = kit.skin;
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

    const position = race.isFinished ? race.playerPosition : race.livePosition;
    const cols = [
      ['DISTANCIA', `${runner.distance.toFixed(1)} m`],
      ['VELOCIDAD', `${runner.speed.toFixed(2)} m/s`],
      ['CADENCIA', `${runner.cadence.toFixed(1)} /s`],
      ['POSICIÓN', `${position}/${race.fieldSize}`],
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
    ctx.fillStyle = COLORS.accent;
    ctx.font = 'bold 16px ui-monospace, monospace';
    const title = race.isTimeTrial
      ? race.level.name.toUpperCase()
      : `${race.level.id}. ${race.level.name.toUpperCase()}`;
    ctx.fillText(title, VIEW_WIDTH - 28, 48);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    const best = stats.best ? `${stats.best.toFixed(2)} s` : '—';
    ctx.fillText(`TU RÉCORD  ${best}`, VIEW_WIDTH - 28, 70);

    ctx.textAlign = 'center';
    if (race.state === 'idle') {
      this.drawBanner('ALTERNA ← →  PARA CORRER', 'ESC para volver al menú');
    } else if (race.state === 'set') {
      this.drawStartCall(race.setPhase);
    } else if (race.isFinished) {
      this.drawResults(race, stats);
    }
  }

  /** "En sus marcas... listos... ¡ya!". Sin descalificación por salir antes. */
  drawStartCall(label) {
    const { ctx } = this;
    const isGun = label === '¡YA!';

    ctx.fillStyle = isGun ? COLORS.accent : COLORS.text;
    ctx.font = `bold ${isGun ? 66 : 40}px ui-monospace, monospace`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10, 14, 18, 0.8)';
    ctx.strokeText(label, VIEW_WIDTH / 2, 250);
    ctx.fillText(label, VIEW_WIDTH / 2, 250);
  }

  drawResults(race, stats) {
    const { ctx } = this;
    const rows = race.standings;
    const unlockOffset = stats.unlocked ? 20 : 0;
    const width = 460;
    const height = 108 + unlockOffset + rows.length * 26;
    const x = (VIEW_WIDTH - width) / 2;
    const y = (VIEW_HEIGHT - height) / 2;

    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();

    const won = race.won;
    let title = `${race.playerPosition}º PUESTO`;
    if (race.isTimeTrial) title = `${race.time.toFixed(2)} s`;
    else if (won) title = '¡GANASTE!';

    ctx.fillStyle = won || race.isTimeTrial ? COLORS.accent : COLORS.text;
    ctx.font = 'bold 30px ui-monospace, monospace';
    ctx.fillText(title, VIEW_WIDTH / 2, y + 46);

    const subtitle = race.isTimeTrial
      ? (stats.isRecord ? 'NUEVO RÉCORD' : 'Tu mejor tiempo sigue en pie')
      : `${race.time.toFixed(2)} s${stats.isRecord ? '  ·  RÉCORD DE LA CATEGORÍA' : ''}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(subtitle, VIEW_WIDTH / 2, y + 68);

    if (stats.unlocked) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`DESBLOQUEADA: ${stats.unlocked}`, VIEW_WIDTH / 2, y + 88);
    }

    rows.forEach((row, i) => {
      const rowY = y + 100 + unlockOffset + i * 26;
      ctx.textAlign = 'left';
      ctx.fillStyle = row.isPlayer ? COLORS.accent : COLORS.textDim;
      ctx.font = `${row.isPlayer ? 'bold ' : ''}14px ui-monospace, monospace`;
      ctx.fillText(`${row.position}.`, x + 28, rowY);
      ctx.fillText(row.name, x + 64, rowY);
      ctx.textAlign = 'right';
      ctx.fillText(`${row.time.toFixed(2)} s`, x + width - 28, rowY);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('R para repetir  ·  ESC para el menú', VIEW_WIDTH / 2, y + height - 14);
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

export { Renderer, VIEW_WIDTH, VIEW_HEIGHT };
