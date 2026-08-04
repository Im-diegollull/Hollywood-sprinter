import { Race } from './game/Race.js';
import { Input } from './game/Input.js';
import { Renderer } from './render/Renderer.js';
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

let screen = SCREEN.MENU;
let finishedAt = 0;

const stats = {
  best: null,
  isRecord: false,
  unlocked: null, // nombre de la categoría recién desbloqueada, si la hay
};

menu.setUnlocked(getUnlocked());

function startRace(level) {
  race.setLevel(level, getGhost());
  stats.best = getBest(recordKey(level));
  stats.isRecord = false;
  stats.unlocked = null;
  screen = SCREEN.RACE;
}

function restart() {
  if (race.isFinished && performance.now() - finishedAt < RESTART_LOCK * 1000) return;
  race.reset();
  stats.isRecord = false;
  stats.unlocked = null;
}

function toMenu() {
  menu.setUnlocked(getUnlocked());
  screen = SCREEN.MENU;
}

/** Cierre de carrera: récord, replay del fantasma y desbloqueo. */
function onFinish(now) {
  finishedAt = now;
  const level = race.level;

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

input.onPress = (side, clock) => {
  if (screen !== SCREEN.RACE || race.isFinished) return;
  race.press(side, clock);
};

input.onNavigate = (delta) => {
  if (screen === SCREEN.MENU) menu.move(delta);
};

input.onConfirm = () => {
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

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap para evitar saltos
  lastTime = now;

  if (screen === SCREEN.MENU) {
    renderer.drawMenu(menu, (id) => getBest(`categoria-${id}`));
  } else {
    const wasRunning = race.isRunning;
    race.update(dt, now / 1000);
    if (wasRunning && race.isFinished) onFinish(now);
    stats.debug = debugPanel.visible;
    renderer.draw(race, stats);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
