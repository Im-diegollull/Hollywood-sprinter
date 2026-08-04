import { TUNING, DEFAULT_TUNING, resetTuning } from '../game/Physics.js';

// [clave, min, max, step]
const CONTROLS = [
  ['SPEED_PER_CADENCE', 0.5, 3, 0.05],
  ['ACCEL_START', 2, 15, 0.1],
  ['ACCEL_MAIN', 4, 25, 0.1],
  ['ACCEL_THRESHOLD', 0, 12, 0.5],
  ['DECAY_RATE', 2, 20, 0.1],
  ['GAP_SMOOTHING', 0.05, 0.8, 0.01],
];

/**
 * Panel de calibración en vivo. Solo toca TUNING; no conoce el juego.
 */
class DebugPanel {
  constructor(root) {
    this.root = root;
    this.container = root.querySelector('#debug-controls');
    this.sliders = new Map();
    this.build();
    root.querySelector('#debug-reset').addEventListener('click', () => {
      resetTuning();
      this.sync();
    });
  }

  build() {
    for (const [key, min, max, step] of CONTROLS) {
      const label = document.createElement('label');
      label.innerHTML = `
        <span class="row"><span>${key}</span><span class="val" data-val="${key}"></span></span>
      `;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = TUNING[key];
      slider.addEventListener('input', () => {
        TUNING[key] = parseFloat(slider.value);
        this.updateValue(key);
      });
      label.appendChild(slider);
      this.container.appendChild(label);
      this.sliders.set(key, slider);
      this.updateValue(key);
    }
  }

  updateValue(key) {
    const out = this.container.querySelector(`[data-val="${key}"]`);
    if (out) out.textContent = TUNING[key].toFixed(2);
  }

  sync() {
    for (const key of Object.keys(DEFAULT_TUNING)) {
      const slider = this.sliders.get(key);
      if (slider) slider.value = TUNING[key];
      this.updateValue(key);
    }
  }

  toggle() {
    this.root.classList.toggle('hidden');
  }

  get visible() {
    return !this.root.classList.contains('hidden');
  }
}

export { DebugPanel };
