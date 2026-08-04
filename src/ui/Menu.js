import { LEVELS } from '../data/levels.js';

const SCREEN = {
  MAIN: 'main',
  LEVELS: 'levels',
};

const MAIN_ITEMS = [
  { id: 'campaign', label: 'CARRERA', hint: 'Las 9 categorías en orden' },
  { id: 'timetrial', label: 'CONTRARRELOJ', hint: 'Solo tú y el cronómetro' },
];

/**
 * Menú principal y selector de categoría.
 *
 * No conoce el estado del juego: recibe cuántas categorías hay desbloqueadas
 * y devuelve una acción cuando el jugador confirma. Quien decide qué hacer
 * con esa acción es main.js.
 */
class Menu {
  constructor() {
    this.screen = SCREEN.MAIN;
    this.index = 0;
    this.unlocked = 1;
  }

  setUnlocked(unlocked) {
    this.unlocked = unlocked;
  }

  get items() {
    if (this.screen === SCREEN.MAIN) return MAIN_ITEMS;
    return LEVELS.map((level) => ({
      id: level.id,
      label: `${level.id}. ${level.name}`,
      level,
      locked: level.id > this.unlocked,
    }));
  }

  get selected() {
    return this.items[this.index];
  }

  move(delta) {
    const items = this.items;
    this.index = (this.index + delta + items.length) % items.length;
  }

  /** @returns {{type: string, level?: object}} acción a ejecutar */
  select() {
    const item = this.selected;

    if (this.screen === SCREEN.MAIN) {
      if (item.id === 'timetrial') return { type: 'timetrial' };
      this.screen = SCREEN.LEVELS;
      // Arranca sobre la categoría más alta que tengas desbloqueada
      this.index = Math.min(this.unlocked, LEVELS.length) - 1;
      return { type: 'none' };
    }

    if (item.locked) return { type: 'locked' };
    return { type: 'race', level: item.level };
  }

  /** @returns {boolean} true si el menú ha retrocedido de pantalla */
  back() {
    if (this.screen === SCREEN.LEVELS) {
      this.screen = SCREEN.MAIN;
      this.index = 0;
      return true;
    }
    return false;
  }

  reset() {
    this.screen = SCREEN.MAIN;
    this.index = 0;
  }
}

export { Menu, SCREEN };
