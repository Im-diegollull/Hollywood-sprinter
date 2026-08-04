const KEY_MAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'left',
  KeyX: 'right',
};

/**
 * Teclado + táctil. Traduce todo a dos señales: 'left' y 'right'.
 * No conoce las reglas del juego, solo reporta pulsaciones.
 */
class Input {
  /**
   * @param {HTMLElement} target zona táctil (se divide en dos mitades)
   */
  constructor(target) {
    this.target = target;
    this.onPress = null;        // (side: 'left' | 'right') => void
    this.onConfirm = null;      // () => void   Espacio / Enter / tap
    this.onRestart = null;      // () => void   R
    this.onToggleDebug = null;  // () => void   F2
    this.onSelectLevel = null;  // (id: 1..9) => void   teclas numéricas

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('pointerdown', this._onPointerDown);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onKeyDown(e) {
    if (e.repeat) return;

    const side = KEY_MAP[e.code];
    if (side) {
      e.preventDefault();
      this.onPress?.(side);
      return;
    }

    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      this.onSelectLevel?.(Number(digit[1]));
      return;
    }

    switch (e.code) {
      case 'Space':
      case 'Enter':
        e.preventDefault();
        this.onConfirm?.();
        break;
      case 'KeyR':
        this.onRestart?.();
        break;
      case 'F2':
        e.preventDefault();
        this.onToggleDebug?.();
        break;
    }
  }

  _onPointerDown(e) {
    e.preventDefault();
    const rect = this.target.getBoundingClientRect();
    const side = e.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
    this.onPress?.(side);
    this.onConfirm?.();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('pointerdown', this._onPointerDown);
  }
}

export { Input };
