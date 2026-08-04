import { Race } from './game/Race.js';
import { Input } from './game/Input.js';
import { Renderer } from './render/Renderer.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { getLevel } from './data/levels.js';
import { getBest, saveBest } from './storage/Records.js';

// Selector de categoría con las teclas 1-9. Provisional: el menú de verdad
// llega en la semana 5-6, pero sin esto no hay forma de probar las 9.
const START_LEVEL = 1;
const RESTART_LOCK = 0.4; // s de gracia tras la meta para no reiniciar sin querer

const recordKey = (level) => `categoria-${level.id}`;

const canvas = document.getElementById('game');
const race = new Race(getLevel(START_LEVEL), getBest('categoria-8'));
const renderer = new Renderer(canvas, race.distance);
const debugPanel = new DebugPanel(document.getElementById('debug'));
const input = new Input(document.getElementById('app'));

const stats = {
  best: getBest(recordKey(race.level)),
  isRecord: false,
};

let finishedAt = 0;

function restart() {
  if (race.isFinished && performance.now() - finishedAt < RESTART_LOCK * 1000) return;
  race.reset();
  stats.isRecord = false;
}

function selectLevel(id) {
  const level = getLevel(id);
  if (level === race.level) return;
  // El nivel 9 corre contra tu mejor tiempo de God Velocity
  race.setLevel(level, getBest('categoria-8'));
  stats.best = getBest(recordKey(level));
  stats.isRecord = false;
}

input.onPress = (side) => {
  if (race.isFinished) return;
  race.press(side);
};
input.onConfirm = () => {
  if (race.isFinished) restart();
  else race.begin();
};
input.onRestart = restart;
input.onSelectLevel = selectLevel;
input.onToggleDebug = () => debugPanel.toggle();

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap para evitar saltos
  lastTime = now;

  const wasRunning = race.isRunning;
  race.update(dt);

  if (wasRunning && race.isFinished) {
    finishedAt = now;
    stats.isRecord = saveBest(recordKey(race.level), race.time);
    if (stats.isRecord) stats.best = race.time;
  }

  renderer.draw(race, stats);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
