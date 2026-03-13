import { INPUT } from '../config.js';

/**
 * InputSystem – keyboard state → bitmask each frame.
 * Supports both keyboard polling and direct bitmask injection (for network input).
 */
export class InputSystem {
  constructor(scene) {
    const kb = scene.input.keyboard;

    this._keys = {
      up:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      w:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      s:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };

    this._override = null;
  }

  /** Inject a bitmask from the network (overrides local keyboard for one frame). */
  inject(mask) { this._override = mask; }

  /** Read current bitmask. */
  sample() {
    if (this._override !== null) {
      const m = this._override;
      this._override = null;
      return m;
    }
    return this._fromKeyboard();
  }

  _fromKeyboard() {
    let m = 0;
    const k = this._keys;

    if (k.up.isDown    || k.w.isDown)     m |= INPUT.THRUST;
    if (k.left.isDown  || k.a.isDown)     m |= INPUT.ROTATE_LEFT;
    if (k.right.isDown || k.d.isDown)     m |= INPUT.ROTATE_RIGHT;
    if (k.space.isDown)                   m |= INPUT.FIRE;
    if (k.s.isDown)                       m |= INPUT.SHIELD;

    return m;
  }

  destroy() {
    for (const key of Object.values(this._keys)) key.destroy();
  }
}
