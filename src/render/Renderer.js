import { Track, FORWARD, LANE_PITCH } from './Track.js';
import { PLAYER_KIT, kitFor } from './Kits.js';

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

// Metros por ciclo completo (las dos piernas). Un velocista da unos 4.4 pasos
// por segundo a tope, así que a 9 m/s el ciclo dura ~0.45 s. Con 2.0 m las
// piernas iban al doble de rápido de lo real y se veía acelerado.
const STRIDE_LENGTH = 3.6;

/**
 * Ciclo de zancada de una pierna, en ocho poses.
 *
 * Cada pose da la posición de rodilla y pie respecto a la cadera: `F` es hacia
 * delante en la pista y `D` hacia abajo. El suelo está a 17 de la cadera.
 *
 * La clave es que el ciclo NO es simétrico. Un sprint tiene empuje, vuelo y
 * contacto, y la rodilla sube mucho más de lo que baja: el talón se pega al
 * glúteo y la pierna se pliega en el aire. Interpolar dos senos desfasados
 * daba un vaivén regular que el ojo lee como muñeco por muy articulado que
 * esté.
 */
const STRIDE_POSES = [
  { kneeF: 3.5, kneeD: 8, footF: 1.5, footD: 9 },  // contacto con el suelo
  { kneeF: 0, kneeD: 8, footF: 0, footD: 9 },      // apoyo bajo el cuerpo
  { kneeF: -4, kneeD: 8, footF: -5, footD: 8 },    // impulso, pierna atrás
  { kneeF: -5, kneeD: 6, footF: 1, footD: 3 },     // talón al glúteo
  { kneeF: 2, kneeD: 4, footF: 2, footD: 2 },      // la rodilla sube
  { kneeF: 6, kneeD: 3, footF: 4, footD: 4 },      // rodilla arriba del todo
  { kneeF: 6, kneeD: 5, footF: 6, footD: 8 },      // estira la pierna
  { kneeF: 5, kneeD: 7, footF: 4, footD: 9 },      // baja a buscar el suelo
];

// De pie y quieto. Se mezcla con el ciclo según el esfuerzo, para que parado
// el corredor no aparezca con una pierna en el aire.
const STAND_POSE = { kneeF: 0, kneeD: 8, footF: 0, footD: 9 };

/** Brazos, en contrafase con las piernas. Codo doblado, mano a la barbilla. */
const ARM_POSES = [
  { elbowF: -3, elbowD: 7, handF: 3, handD: 8 },
  { elbowF: -4, elbowD: 7, handF: -1, handD: 9 },
  { elbowF: 2, elbowD: 7, handF: 4, handD: 4 },
  { elbowF: 4, elbowD: 6, handF: 6, handD: 2 },
  { elbowF: 2, elbowD: 7, handF: 5, handD: 4 },
  { elbowF: -1, elbowD: 7, handF: 2, handD: 7 },
];
const ARM_STAND = { elbowF: 0, elbowD: 7, handF: 0, handD: 9 };

/** Interpola circularmente entre las poses de un ciclo. */
function samplePose(poses, cycle) {
  const n = poses.length;
  const f = (((cycle % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  const k = f - i;
  const a = poses[i];
  const b = poses[(i + 1) % n];
  const out = {};
  for (const key of Object.keys(a)) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** Mezcla una pose con la de reposo según el esfuerzo (0 = parado). */
function blendPose(pose, rest, effort) {
  const out = {};
  for (const key of Object.keys(pose)) {
    out[key] = rest[key] + (pose[key] - rest[key]) * effort;
  }
  return out;
}

// Dirección de avance en pantalla: las extremidades se balancean a lo largo
// de la pista, no en horizontal.
const DIR = FORWARD;

// El corredor se mide contra el ancho de carril, no en píxeles fijos: si se
// mueve el zoom de la pista, los atletas acompañan sin retocar nada. En el
// original ocupan aproximadamente un carril de alto.
const RUNNER_HEIGHT = LANE_PITCH * 0.86;

// Adelanto de cámara hacia quien va en cabeza
const LOOK_AHEAD_MAX = 5.0;    // metros
const LOOK_AHEAD_SHARE = 0.55; // fracción de la ventaja del líder
const LOOK_AHEAD_EASE = 0.45;  // s de constante de tiempo

const COLORS = {
  text: '#e8eef3',
  textDim: '#8ea0b2',
  accent: '#ffd166',
  panel: 'rgba(13, 17, 22, 0.82)',
  shoes: '#e8eef3',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

// Los rivales cambian de aspecto en cada categoría (ver render/Kits.js); el
// jugador lleva siempre el mismo equipo para encontrarse de un vistazo.

/**
 * Dibujo en canvas. Único sitio del proyecto que convierte metros a píxeles.
 */
class Renderer {
  constructor(canvas, raceDistance) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = new Track(raceDistance);
    this.camera = 0;   // adelanto actual, en metros
    this.areas = [];   // zonas tocables del frame actual
    this.flash = { left: 0, right: 0 };  // realce al pulsar los botones grandes
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Píxel de pantalla -> coordenadas de la vista de 960x540.
   * El canvas va centrado con bandas a los lados, así que hay que descontar
   * su posición: un toque en la banda cae fuera del rango y no acierta nada.
   */
  toView(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
      y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
  }

  /**
   * Zona tocable que hay bajo un punto, o null.
   *
   * Las zonas las registra el propio dibujo en cada frame (`this.areas`), así
   * que lo que se puede tocar es exactamente lo que se está viendo. Se
   * recorren al revés para que gane lo dibujado por encima.
   */
  hitAt(vx, vy) {
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i];
      if (vx >= a.x && vx <= a.x + a.w && vy >= a.y && vy <= a.y + a.h) return a.id;
    }
    return null;
  }

  area(id, x, y, w, h) {
    this.areas.push({ id, x, y, w, h });
  }

  /** @returns {boolean} el hueco visible es más alto que ancho */
  get isPortrait() {
    return window.innerHeight > window.innerWidth;
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

  draw(race, stats, dt = 0.016) {
    const runner = race.runner;
    this.areas.length = 0;

    this.track.follow(runner.distance + this.lookAhead(race, dt), runner.lane);
    this.track.draw(this.ctx, VIEW_WIDTH, VIEW_HEIGHT);
    this.drawStarter(this.track);

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
        kit: kitFor(race.level, Boolean(rival.isGhost), rival.name),
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
   * Adelanto de cámara.
   *
   * Anclar la cámara al jugador y ya está deja los rivales fuera de pantalla:
   * salen a velocidad máxima desde el disparo y en dos segundos te sacan más
   * metros de los que caben. La cámara se adelanta hasta LOOK_AHEAD_MAX metros
   * hacia quien va primero, y vuelve sola cuando lo alcanzas.
   *
   * Se suaviza con una constante de tiempo, no con un factor por frame, para
   * que no dependa del framerate.
   */
  lookAhead(race, dt) {
    let lead = 0;
    for (const rival of race.rivals) {
      lead = Math.max(lead, rival.distance - race.runner.distance);
    }

    const target = Math.min(lead * LOOK_AHEAD_SHARE, LOOK_AHEAD_MAX);
    const k = 1 - Math.exp(-dt / LOOK_AHEAD_EASE);
    this.camera += (target - this.camera) * k;
    return this.camera;
  }

  /**
   * Menú principal y selector de categoría, sobre la pista como fondo.
   * @param {object} menu instancia de ui/Menu
   * @param {(levelId: number) => number|null} recordFor récord por categoría
   */
  drawMenu(menu, recordFor, stats = {}) {
    const { ctx } = this;
    this.areas.length = 0;

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
    const width = 520;
    const x = (VIEW_WIDTH - width) / 2;
    const top = 164;
    // El alto de fila se aprieta según cuántas categorías haya, para que la
    // lista nunca pise el pie de página al añadir niveles nuevos.
    const rowHeight = Math.min(38, (VIEW_HEIGHT - 62 - top) / Math.max(items.length - 1, 1));

    items.forEach((item, i) => {
      const y = top + i * rowHeight;
      const active = i === menu.index;
      const locked = Boolean(item.locked);
      this.area(`menu:${i}`, x, y - rowHeight * 0.55, width, rowHeight);

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
      stats.touch
        ? 'Toca una categoría para empezar'
        : '↑ ↓ para elegir  ·  ENTER para empezar  ·  ESC para volver  ·  M silencia',
      VIEW_WIDTH / 2,
      VIEW_HEIGHT - 30
    );

    if (menu.screen !== 'main') this.drawBackButton(stats);
    if (stats.touch) this.drawRotateHint();
  }

  /**
   * Volver atrás sin teclado. Solo aparece cuando hace falta.
   * En carrera va arriba en el centro: la esquina la ocupa el cronómetro.
   */
  drawBackButton(stats = {}, x = 20, y = 20) {
    const { ctx } = this;
    const w = 92;
    const h = 30;
    this.area('back', x, y, w, h);

    ctx.fillStyle = 'rgba(13, 17, 22, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.textDim;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stats.touch ? '‹ VOLVER' : '‹ ESC', x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * La pista es apaisada por naturaleza: en vertical el juego se queda en una
   * tira diminuta. Se sigue pudiendo jugar, pero conviene avisar.
   */
  drawRotateHint() {
    if (!this.isPortrait) return;
    const { ctx } = this;
    const w = 300;
    const h = 46;
    const x = (VIEW_WIDTH - w) / 2;
    const y = VIEW_HEIGHT - 92;

    ctx.fillStyle = 'rgba(255, 209, 102, 0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#101418';
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻  GIRA EL TELÉFONO', VIEW_WIDTH / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
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
    // El muñeco está trazado para 34 px de alto; el resto es escalar. Cada
    // categoría trae su propio tamaño: los niños son bajitos y los dioses no.
    const s = (RUNNER_HEIGHT / 34) * (kit.scale ?? 1);

    ctx.save();
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, (fallen ? 14 : 8) * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aura de cyborgs, marcianos y dioses: un halo suave detrás del cuerpo
    if (kit.glow) {
      const r = 22 * s;
      const aura = ctx.createRadialGradient(x, y - 16 * s, 0, x, y - 16 * s, r);
      aura.addColorStop(0, kit.glow);
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(x, y - 16 * s, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (kit.alpha) ctx.globalAlpha = kit.alpha;
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (fallen) this.drawFallenRunner(0, 0, kit);
    else this.drawRunningRunner(0, 0, distance, speed, kit);

    ctx.restore();
  }

  drawRunningRunner(x, y, distance, speed, kit) {
    const { ctx } = this;
    const cycle = distance / STRIDE_LENGTH;
    const effort = Math.min(speed / 7, 1);
    // El cuerpo sube en el vuelo y baja al contacto: dos veces por ciclo
    const bob = Math.abs(Math.sin(cycle * Math.PI * 2)) * 2 * effort;

    const hipY = y - 17 - bob;
    const shoulderY = y - 31 - bob;
    const lean = effort * 2.2 * DIR.x;   // se echa hacia delante al correr

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Piernas: muslo y pantorrilla articulados en la rodilla, siguiendo las
    // poses del ciclo. La pierna izquierda va media vuelta desfasada.
    for (const side of [0, 1]) {
      const pose = blendPose(
        samplePose(STRIDE_POSES, cycle + side * 0.5),
        STAND_POSE,
        effort
      );

      const hipX = x + (side === 0 ? -3 : 3);
      const kneeX = hipX + DIR.x * pose.kneeF + lean;
      const kneeY = hipY + pose.kneeD + DIR.y * pose.kneeF;
      const footX = kneeX + DIR.x * pose.footF;
      const footY = kneeY + pose.footD + DIR.y * pose.footF;

      ctx.strokeStyle = kit.skin;
      ctx.lineWidth = side === 0 ? 4.2 : 4.6;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      ctx.fillStyle = kit.shoes;
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
    ctx.fillStyle = kit.bib;
    ctx.fillRect(x - 2.5, shoulderY + 5, 5, 4);

    // Brazos: codo doblado. Van en contrafase con la pierna del mismo lado,
    // que es lo que hace un corredor de verdad para compensar el giro.
    for (const side of [0, 1]) {
      // Manguito de compresión en un solo brazo, como lo lleva Nacho
      ctx.strokeStyle = side === 0 && kit.sleeve ? kit.sleeve : kit.skin;
      const pose = blendPose(
        samplePose(ARM_POSES, cycle + 0.5 + side * 0.5),
        ARM_STAND,
        effort
      );

      const shoulderX = x + (side === 0 ? -6 : 6) + lean;
      const elbowX = shoulderX + DIR.x * pose.elbowF;
      const elbowY = shoulderY + 2 + pose.elbowD + DIR.y * pose.elbowF;
      const handX = elbowX + DIR.x * pose.handF;
      const handY = elbowY + (pose.handD - 7) + DIR.y * pose.handF;

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

  /**
   * Cabeza vista de espaldas. El estilo lo pone el kit de la categoría: es lo
   * que más distingue a un niño de un cyborg desde atrás.
   */
  drawHead(x, shoulderY, kit, radius = 4.8) {
    const { ctx } = this;
    const cy = shoulderY - radius;
    const style = kit.head ?? 'normal';

    // La coleta y las antenas salen por detrás, así que van antes que la cara
    if (style === 'ponytail') {
      ctx.fillStyle = kit.hair;
      ctx.save();
      ctx.translate(x - DIR.x * radius * 0.7, cy + 0.6);
      ctx.rotate(Math.atan2(DIR.y, DIR.x));
      ctx.beginPath();
      ctx.ellipse(-radius * 0.9, 0, radius * 1.15, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (style === 'antennae') {
      ctx.strokeStyle = kit.hair;
      ctx.lineWidth = 0.9;
      for (const side of [-1, 1]) {
        const tipX = x + side * radius * 0.9;
        const tipY = cy - radius * 2.1;
        ctx.beginPath();
        ctx.moveTo(x + side * radius * 0.35, cy - radius * 0.7);
        ctx.quadraticCurveTo(x + side * radius * 1.1, cy - radius * 1.5, tipX, tipY);
        ctx.stroke();
        ctx.fillStyle = kit.shoes;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(x, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    if (style === 'visor') {
      // Banda metálica con la luz del sensor asomando por el lado
      ctx.fillStyle = kit.singlet;
      ctx.fillRect(x - radius, cy - radius * 0.35, radius * 2, radius * 0.7);
      ctx.fillStyle = kit.bib;
      ctx.beginPath();
      ctx.arc(x + DIR.x * radius * 0.55, cy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else if (style !== 'antennae') {
      // Pelo: media luna por arriba, que es lo que se ve de espaldas
      ctx.fillStyle = kit.hair;
      ctx.beginPath();
      ctx.arc(x, cy - 0.8, radius * 0.95, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fill();
    }

    if (style === 'halo') {
      ctx.strokeStyle = kit.bib;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(x, cy - radius * 1.9, radius * 1.15, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawHUD(race, stats) {
    const { ctx } = this;
    const runner = race.runner;

    // El original no tiene HUD: solo la pista. Aquí queda el cronómetro y la
    // posición, sin barra de fondo, para no tapar la carrera.
    const position = race.isFinished ? race.playerPosition : race.livePosition;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 32px ui-monospace, monospace';
    ctx.fillText(race.time.toFixed(2), 24, 46);

    if (!race.isTimeTrial) {
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.fillText(`${position}º de ${race.fieldSize}`, 24, 68);
    }

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText(
      race.isTimeTrial ? race.level.name.toUpperCase() : `${race.level.id}. ${race.level.name.toUpperCase()}`,
      VIEW_WIDTH - 24,
      42
    );
    if (stats.best) {
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(`récord ${stats.best.toFixed(2)} s`, VIEW_WIDTH - 24, 62);
    }
    if (stats.muted) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('SIN SONIDO · M', VIEW_WIDTH - 24, stats.best ? 80 : 62);
    }
    ctx.restore();

    if (stats.touch) this.drawTouchPads(race, stats);
    if (stats.debug) this.drawDebugReadout(runner);

    ctx.textAlign = 'center';
    if (race.state === 'idle') {
      this.drawBanner(
        stats.touch ? 'TOCA ◀ ▶ PARA CORRER' : 'ALTERNA ← →  PARA CORRER',
        stats.touch ? 'Un pulgar en cada botón, alternando' : 'ESC para volver al menú'
      );
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
      ctx.fillText(
        stats.touch ? 'Los dos a la vez no valen: alterna' : 'Las dos teclas a la vez no valen: alterna',
        VIEW_WIDTH / 2,
        222
      );
    } else if (race.isFinished) {
      this.drawResults(race, stats);
    }
  }

  /**
   * Los dos botones gordos del móvil.
   *
   * Van abajo del todo y ocupan casi media pantalla de ancho cada uno: se
   * juega con los pulgares y a 14 pulsaciones por segundo no se puede estar
   * apuntando. La zona que responde de verdad es toda la mitad de la pantalla
   * (lo decide main.js); esto es solo la parte que se ve.
   */
  drawTouchPads(race, stats) {
    const { ctx } = this;
    const h = 112;
    const y = VIEW_HEIGHT - h - 16;
    const w = VIEW_WIDTH / 2 - 26;

    for (const [side, x] of [['left', 16], ['right', VIEW_WIDTH / 2 + 10]]) {
      this.area(`pad:${side}`, x, y, w, h);

      const lit = this.flash[side] > 0;
      ctx.fillStyle = lit ? 'rgba(255, 209, 102, 0.34)' : 'rgba(13, 17, 22, 0.34)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 16);
      ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(255, 209, 102, 0.9)' : 'rgba(232, 238, 243, 0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = lit ? '#ffd166' : 'rgba(232, 238, 243, 0.7)';
      ctx.font = 'bold 44px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(side === 'left' ? '◀' : '▶', x + w / 2, y + h / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    }

    ctx.lineWidth = 1;
    if (!race.isFinished) this.drawBackButton(stats, VIEW_WIDTH / 2 - 46, 12);
    this.drawRotateHint();
  }

  /** Apaga el realce de los botones. Constante de tiempo, no por frame. */
  fadeFlash(dt) {
    for (const side of ['left', 'right']) {
      this.flash[side] = Math.max(this.flash[side] - dt, 0);
    }
  }

  /** Lectura de calibración. Solo con el panel F2 abierto. */
  drawDebugReadout(runner) {
    const { ctx } = this;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(232, 238, 243, 0.85)';
    ctx.font = '12px ui-monospace, monospace';
    const rows = [
      `dist  ${runner.distance.toFixed(1)} m`,
      `vel   ${runner.speed.toFixed(2)} m/s`,
      `cad   ${runner.cadence.toFixed(1)} /s`,
      `puls  ${runner.strokes}   caídas ${runner.stumbles}`,
    ];
    rows.forEach((row, i) => ctx.fillText(row, 24, VIEW_HEIGHT - 74 + i * 16));
  }

  /**
   * "En sus marcas... listos... ¡ya!" en el bocadillo blanco del original,
   * apoyado sobre el césped a la izquierda de la salida.
   */
  drawStartCall(label) {
    const { ctx } = this;
    const isGun = label === '¡YA!';
    const x = 300;
    const y = 250;

    ctx.font = `bold ${isGun ? 30 : 24}px ui-monospace, monospace`;
    const halfWidth = ctx.measureText(label).width / 2 + 26;

    ctx.fillStyle = '#fbfbfb';
    ctx.beginPath();
    ctx.ellipse(x, y, halfWidth, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // rabito del bocadillo, apuntando al juez de salida
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 26);
    ctx.lineTo(x + 48, y + 58);
    ctx.lineTo(x + 30, y + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isGun ? '#c8102e' : '#1b1f24';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 9);
  }

  /** Juez de salida, de rojo sobre el césped. Detalle del original. */
  drawStarter(track) {
    const { ctx } = this;
    const p = track.project(-1.2, -1.1);
    if (p.x < -40 || p.x > VIEW_WIDTH + 40 || p.y > VIEW_HEIGHT + 60) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b1f24';                  // pantalón
    ctx.fillRect(p.x - 6, p.y - 24, 12, 24);
    ctx.fillStyle = '#d0212b';                  // chaqueta
    ctx.fillRect(p.x - 8, p.y - 44, 16, 21);
    ctx.fillStyle = '#f0c9a8';                  // cabeza
    ctx.beginPath();
    ctx.arc(p.x, p.y - 50, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d0212b';                  // gorra
    ctx.beginPath();
    ctx.arc(p.x, p.y - 52, 6.2, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 8, p.y - 53, 16, 2.5);
    ctx.restore();
  }

  drawResults(race, stats) {
    const { ctx } = this;
    const rows = race.standings;
    const unlockOffset = stats.unlocked ? 22 : 0;
    const width = 460;
    const height = 126 + unlockOffset + rows.length * 26;
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

    ctx.fillStyle = COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      `${race.averageCadence.toFixed(1)} pulsaciones/s de media${race.runner.stumbles ? `  ·  ${race.runner.stumbles} caída(s)` : ''}`,
      VIEW_WIDTH / 2,
      y + 88
    );

    if (stats.unlocked) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`DESBLOQUEADA: ${stats.unlocked}`, VIEW_WIDTH / 2, y + 110);
    }

    rows.forEach((row, i) => {
      const rowY = y + 120 + unlockOffset + i * 26;
      ctx.textAlign = 'left';
      ctx.fillStyle = row.isPlayer ? COLORS.accent : COLORS.textDim;
      ctx.font = `${row.isPlayer ? 'bold ' : ''}14px ui-monospace, monospace`;
      ctx.fillText(`${row.position}.`, x + 28, rowY);
      ctx.fillText(row.name, x + 64, rowY);
      ctx.textAlign = 'right';
      ctx.fillText(`${row.time.toFixed(2)} s`, x + width - 28, rowY);
    });

    // Al ganar el juego te devuelve solo al menú: la categoría está hecha y
    // lo siguiente está allí. Perder invita a repetir en el sitio.
    ctx.textAlign = 'center';
    ctx.fillStyle = stats.menuIn != null ? COLORS.accent : COLORS.textDim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(
      stats.menuIn != null
        ? (stats.touch
            ? `Al menú en ${stats.menuIn}…  ·  toca para ir ya`
            : `Al menú en ${stats.menuIn}…  ·  ENTER para ir ya  ·  R para repetir`)
        : (stats.touch
            ? 'Toca para repetir  ·  ‹ VOLVER para el menú'
            : 'R para repetir  ·  ESC para el menú'),
      VIEW_WIDTH / 2,
      y + height - 14
    );
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

export { Renderer, VIEW_WIDTH, VIEW_HEIGHT, STRIDE_LENGTH };
