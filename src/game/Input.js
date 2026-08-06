const KEY_MAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'left',
  KeyX: 'right',
};

/**
 * Momento real en que se generó el evento, en segundos.
 *
 * Se usa `timeStamp` y no `performance.now()` porque si la pestaña se congela
 * (cambio de ventana, pausa del recolector) los eventos se encolan y se
 * entregan todos de golpe: leer el reloj al procesarlos daría huecos de
 * milisegundos entre teclas que en realidad se pulsaron separadas, y el
 * corredor se caería sin motivo. `timeStamp` comparte origen con
 * `performance.now()`, así que las dos escalas son la misma.
 */
function eventClock(e) {
  return (e.timeStamp > 0 ? e.timeStamp : performance.now()) / 1000;
}

/**
 * Teclado + táctil. Traduce todo a dos señales: 'left' y 'right'.
 * No conoce las reglas del juego, solo reporta pulsaciones.
 */
class Input {
  /**
   * @param {HTMLElement} target zona que recibe los toques (toda la pantalla)
   */
  constructor(target) {
    this.target = target;
    this.onPress = null;        // (side: 'left'|'right', clock: number) => void
    this.onTap = null;          // (clientX, clientY, clock, pointerType) => void
    this.onConfirm = null;      // () => void   Espacio / Enter
    this.onNavigate = null;     // (delta: -1 | 1) => void   arriba / abajo
    this.onBack = null;         // () => void   Escape
    this.onRestart = null;      // () => void   R
    this.onToggleDebug = null;  // () => void   F2
    this.onToggleMute = null;   // () => void   M

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
      this.onPress?.(side, eventClock(e));
      return;
    }

    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        this.onNavigate?.(-1);
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        this.onNavigate?.(1);
        break;
      case 'Escape':
        this.onBack?.();
        break;
      case 'Space':
      case 'Enter':
        e.preventDefault();
        this.onConfirm?.();
        break;
      case 'KeyR':
        this.onRestart?.();
        break;
      case 'KeyM':
        this.onToggleMute?.();
        break;
      case 'F2':
        e.preventDefault();
        this.onToggleDebug?.();
        break;
    }
  }

  /**
   * Toque o clic. Se reportan las coordenadas en crudo y quién decide qué
   * significan es main.js: aquí no se sabe si debajo hay un botón del menú o
   * media pista. `pointerType` distingue el dedo del ratón, que es lo que
   * hace aparecer los botones grandes.
   */
  _onPointerDown(e) {
    e.preventDefault();
    this.onTap?.(e.clientX, e.clientY, eventClock(e), e.pointerType);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('pointerdown', this._onPointerDown);
  }
}

export { Input };
