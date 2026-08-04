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
      {
        lane: runner.lane,
        distance: runner.distance,
        speed: runner.speed,
        kit: PLAYER_KIT,
        fallen: runner.fallen,
      },
      ...race.rivals.map((rival) => ({
        lane: rival.lane,
        distance: rival.distance,
        speed: rival.speed,
        kit: RIVAL_KITS[rival.lane % RIVAL_KITS.length],
        fallen: false,
      })),
    ].sort((a, b) => b.lane - a.lane);

    for (const entry of field) {
      const feet = this.track.project(entry.distance, entry.lane + 0.5);
      if (feet.x < -60 || feet.x > VIEW_WIDTH + 60) continue;
      this.drawRunner(feet, entry.distance, entry.speed, entry.kit, entry.fallen);
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
   * Corredor de espaldas, con extremidades articuladas.
   *
   * El ciclo va atado a la distancia recorrida, no al reloj: si corre más
   * rápido las piernas se mueven más rápido solas y nunca patina. Cuando
   * lleguen los sprites, solo cambia el dibujo, no este cálculo.
   */
  drawRunner({ x, y }, distance, speed, kit = PLAYER_KIT, fallen = false) {
    const { ctx } = this;

    ctx.save();
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, fallen ? 14 : 8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (fallen) this.drawFallenRunner(x, y, kit);
    else this.drawRunningRunner(x, y, distance, speed, kit);

    ctx.restore();
  }

  drawRunningRunner(x, y, distance, speed, kit) {
    const { ctx } = this;
    const phase = (distance / STRIDE_LENGTH) * Math.PI * 2;
    const effort = Math.min(speed / 7, 1);
    const bob = Math.abs(Math.sin(phase * 2)) * 2 * effort;

    const hipY = y - 17 - bob;
    const shoulderY = y - 31 - bob;
    const lean = effort * 2.2;   // se echa hacia delante al correr

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Piernas: muslo y pantorrilla articulados en la rodilla. La pierna que
    // va hacia delante levanta la rodilla y despega el pie del suelo.
    for (const side of [0, 1]) {
      const p = phase + side * Math.PI;
      const swing = Math.sin(p);
      const lift = Math.max(0, Math.sin(p + 0.5));

      const hipX = x + (side === 0 ? -3 : 3);
      const kneeX = hipX + DIR.x * swing * 5 + lean;
      const kneeY = hipY + 9 - lift * 3.5;
      const footX = kneeX + DIR.x * swing * 6;
      const footY = y - lift * 9 + DIR.y * swing * 4;

      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = side === 0 ? 4.2 : 4.6;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      ctx.fillStyle = COLORS.shoes;
      ctx.beginPath();
      ctx.ellipse(footX + DIR.x * 1.5, footY, 3.2, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pantalón, por encima del arranque de los muslos
    ctx.fillStyle = kit.shorts;
    ctx.beginPath();
    ctx.roundRect(x - 6, hipY - 6, 12, 10, 2);
    ctx.fill();

    // Torso, más estrecho en la cintura que en los hombros
    ctx.fillStyle = kit.singlet;
    ctx.beginPath();
    ctx.moveTo(x - 5.5, hipY - 3);
    ctx.lineTo(x - 7 + lean, shoulderY);
    ctx.lineTo(x + 7 + lean, shoulderY);
    ctx.lineTo(x + 5.5, hipY - 3);
    ctx.closePath();
    ctx.fill();

    // Dorsal
    ctx.fillStyle = 'rgba(20, 24, 30, 0.55)';
    ctx.fillRect(x - 2.5, shoulderY + 5, 5, 4);

    // Brazos: codo doblado, en contrafase con las piernas
    ctx.strokeStyle = kit.skin;
    for (const side of [0, 1]) {
      const p = phase + Math.PI + side * Math.PI;
      const swing = Math.sin(p);
      const shoulderX = x + (side === 0 ? -6 : 6) + lean;
      const elbowX = shoulderX + DIR.x * swing * 3.5;
      const elbowY = shoulderY + 8 + DIR.y * swing * 2;
      const handX = elbowX + DIR.x * swing * 5.5;
      const handY = elbowY - Math.max(0, swing) * 5 + 2;

      ctx.lineWidth = side === 0 ? 3.2 : 3.6;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY + 2);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(handX, handY);
      ctx.stroke();
    }

    this.drawHead(x + lean * 1.4, shoulderY - 1, kit);
  }

  /** Tirado en el suelo tras pulsar las dos teclas a la vez. */
  drawFallenRunner(x, y, kit) {
    const { ctx } = this;
    const along = { x: DIR.x, y: DIR.y };
    const head = { x: x + along.x * 9, y: y + along.y * 9 - 3 };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = kit.skin;

    // piernas y brazos desparramados hacia atrás
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(x - along.x * 4, y - 2);
    ctx.lineTo(x - along.x * 13, y - 5);
    ctx.moveTo(x - along.x * 4, y - 1);
    ctx.lineTo(x - along.x * 12, y + 2);
    ctx.stroke();

    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x + along.x * 5, y - 4);
    ctx.lineTo(x + along.x * 12, y - 1);
    ctx.stroke();

    // torso tumbado
    ctx.fillStyle = kit.singlet;
    ctx.save();
    ctx.translate(x + along.x * 2, y - 3);
    ctx.rotate(Math.atan2(along.y, along.x));
    ctx.beginPath();
    ctx.roundRect(-6, -4.5, 13, 9, 3);
    ctx.fill();
    ctx.restore();

    this.drawHead(head.x, head.y, kit, 4.2);
  }

  drawHead(x, shoulderY, kit, radius = 4.8) {
    const { ctx } = this;
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(x, shoulderY - radius, radius, 0, Math.PI * 2);
    ctx.fill();
    // pelo: media luna por la parte de arriba, que es lo que se ve de espaldas
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(x, shoulderY - radius - 0.8, radius * 0.95, Math.PI * 0.92, Math.PI * 2.08);
    ctx.fill();
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
    } else if (runner.fallen) {
      ctx.fillStyle = '#ff6b5b';
      ctx.font = 'bold 30px ui-monospace, monospace';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(10, 14, 18, 0.8)';
      ctx.strokeText('¡TE CAÍSTE!', VIEW_WIDTH / 2, 200);
      ctx.fillText('¡TE CAÍSTE!', VIEW_WIDTH / 2, 200);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('Las dos teclas a la vez no valen: alterna', VIEW_WIDTH / 2, 222);
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
