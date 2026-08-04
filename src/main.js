import { Race } from './game/Race.js';
import { Input } from './game/Input.js';
import { Renderer } from './render/Renderer.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { getBest, saveBest } from './storage/Records.js';

// Semana 1-2: prototipo de la mecánica. Un cuadrado, 100 m y el crono.
const RECORD_KEY = 'prototype-100m';
const RESTART_LOCK = 0.4; // s de gracia tras la meta para no reiniciar sin querer

const canvas = document.getElementById('game');
const race = new Race();
const renderer = new Renderer(canvas, race.distance);
const debugPanel = new DebugPanel(document.getElementById('debug'));
const input = new Input(document.getElementById('app'));

const stats = {
  best: getBest(RECORD_KEY),
  isRecord: false,
};

let finishedAt = 0;

function restart() {
  if (race.isFinished && performance.now() - finishedAt < RESTART_LOCK * 1000) return;
  race.reset();
  stats.isRecord = false;
}

input.onPress = (side) => {
  if (race.isFinished) return;
  race.press(side);
};
input.onConfirm = () => {
  if (race.isFinished) restart();
};
input.onRestart = restart;
input.onToggleDebug = () => debugPanel.toggle();

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap para evitar saltos
  lastTime = now;

  const wasRunning = race.isRunning;
  race.update(dt);

  if (wasRunning && race.isFinished) {
    finishedAt = now;
    stats.isRecord = saveBest(RECORD_KEY, race.time);
    if (stats.isRecord) stats.best = race.time;
  }

  renderer.draw(race, stats);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
