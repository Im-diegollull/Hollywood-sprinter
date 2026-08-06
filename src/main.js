import { Race } from './game/Race.js';
import { Input } from './game/Input.js';
import { Renderer, STRIDE_LENGTH } from './render/Renderer.js';
import { SFX } from './audio/SFX.js';
import { Menu } from './ui/Menu.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { getLevel, TIME_TRIAL, LEVELS } from './data/levels.js';
import { getBest, saveBest, getUnlocked, unlockLevel, getGhost, saveGhost } from './storage/Records.js';

const SCREEN = { MENU: 'menu', RACE: 'race' };
const GOD_VELOCITY = 8;   // la categoría cuyo replay alimenta al fantasma
const RESTART_LOCK = 0.4; // s de gracia tras la meta para no reiniciar sin querer

const recordKey = (level) => (level.id === 0 ? 'contrarreloj' : `categoria-${level.id}`);

const canvas = document.getElementById('game');
const menu = new Menu();
const race = new Race(getLevel(1), getGhost());
const renderer = new Renderer(canvas, race.distance);
const debugPanel = new DebugPanel(document.getElementById('debug'));
const input = new Input(document.getElementById('app'));
const sfx = new SFX();

let screen = SCREEN.MENU;
let finishedAt = 0;

// Seguimiento del sonido entre frames: media zancada, caídas y el disparo
const audio = { halfStride: 0, stumbles: 0, phase: null };

const stats = {
  best: null,
  isRecord: false,
  unlocked: null, // nombre de la categoría recién desbloqueada, si la hay
};

menu.setUnlocked(getUnlocked());

function resetAudioTracking() {
  audio.halfStride = 0;
  audio.stumbles = 0;
  audio.phase = null;
}

function startRace(level) {
  race.setLevel(level, getGhost());
  stats.best = getBest(recordKey(level));
  stats.isRecord = false;
  stats.unlocked = null;
  screen = SCREEN.RACE;
  resetAudioTracking();
}

function restart() {
  if (race.isFinished && performance.now() - finishedAt < RESTART_LOCK * 1000) return;
  race.reset();
  stats.isRecord = false;
  stats.unlocked = null;
  resetAudioTracking();
}

function toMenu() {
  menu.setUnlocked(getUnlocked());
  screen = SCREEN.MENU;
}

/** Cierre de carrera: récord, replay del fantasma y desbloqueo. */
function onFinish(now) {
  finishedAt = now;
  const level = race.level;

  sfx.finish(race.won || race.isTimeTrial);

  stats.isRecord = saveBest(recordKey(level), race.time);
  if (stats.isRecord) stats.best = race.time;

  // El fantasma del nivel 9 es tu mejor carrera de God Velocity
  if (level.id === GOD_VELOCITY && stats.isRecord) {
    saveGhost(race.replay, race.time);
  }

  if (race.won && level.id > 0 && level.id < LEVELS.length) {
    const next = getLevel(level.id + 1);
    if (unlockLevel(next.id)) stats.unlocked = next.name;
    menu.setUnlocked(getUnlocked());
  }
}

/**
 * Sonido de la carrera. Se llama después de update: lee lo que ha cambiado
 * en este frame en vez de que el juego tenga que avisar de nada.
 *
 * @param {boolean} wasRunning si la carrera ya estaba en marcha antes del update
 */
function updateAudio(race, wasRunning) {
  // El juez canta cada fase de la salida; el "¡ya!" es el disparo
  const phase = race.setPhase;
  if (phase !== audio.phase) {
    if (phase && phase !== '¡YA!') sfx.call();
    audio.phase = phase;
  }
  if (!wasRunning && race.isRunning) sfx.gun();

  if (race.runner.stumbles !== audio.stumbles) {
    audio.stumbles = race.runner.stumbles;
    sfx.stumble();
  }

  // Una pisada por cada media zancada. Va atada a la distancia igual que la
  // animación, así que el sonido cae exactamente cuando el pie toca el suelo.
  if (race.isRunning && !race.runner.fallen) {
    const half = Math.floor((race.runner.distance / STRIDE_LENGTH) * 2);
    if (half !== audio.halfStride) {
      audio.halfStride = half;
      sfx.step(Math.min(race.runner.speed / 12, 1));
    }
  }

  // El público se va calentando conforme se acerca la meta
  if (race.isFinished) return;               // lo lleva el remate de onFinish
  if (race.isRunning) sfx.setCrowd(0.35 + 0.5 * (race.runner.distance / race.distance));
  else sfx.setCrowd(0.25);
}

input.onPress = (side, clock) => {
  sfx.unlock();
  if (screen !== SCREEN.RACE || race.isFinished) return;
  race.press(side, clock);
};

input.onNavigate = (delta) => {
  if (screen === SCREEN.MENU) menu.move(delta);
};

input.onConfirm = () => {
  sfx.unlock();
  if (screen === SCREEN.MENU) {
    const action = menu.select();
    if (action.type === 'race') startRace(action.level);
    else if (action.type === 'timetrial') startRace(TIME_TRIAL);
    return;
  }
  if (race.isFinished) restart();
  else race.begin();
};

input.onBack = () => {
  if (screen === SCREEN.RACE) toMenu();
  else menu.back();
};

input.onRestart = () => {
  if (screen === SCREEN.RACE) restart();
};

input.onToggleDebug = () => debugPanel.toggle();

input.onToggleMute = () => {
  sfx.unlock();
  stats.muted = sfx.toggleMute();
};

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap para evitar saltos
  lastTime = now;

  if (screen === SCREEN.MENU) {
    sfx.setCrowd(0.12);   // el estadio se oye de fondo también en el menú
    renderer.drawMenu(menu, (id) => getBest(`categoria-${id}`));
  } else {
    const wasRunning = race.isRunning;
    race.update(dt, now / 1000);
    if (wasRunning && race.isFinished) onFinish(now);
    updateAudio(race, wasRunning);
    stats.debug = debugPanel.visible;
    renderer.draw(race, stats, dt);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
