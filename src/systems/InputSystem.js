import { INPUT } from '../config.js';

/**
 * InputSystem – keyboard + mouse state → bitmask each frame.
 * Supports both keyboard/mouse polling and direct bitmask injection (for network input).
 */
export class InputSystem {
  constructor(scene) {
    this._scene = scene;
    const kb = scene.input.keyboard;

    this._keys = {
      up:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:  kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
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

  /**
   * Get the mouse aim angle (world-space) relative to a position.
   * Converts screen-space pointer coordinates to world-space using the
   * camera scroll offset, then computes the angle to the target.
   * @param {number} originX  ship world X
   * @param {number} originY  ship world Y
   * @returns {number}  angle in radians (0 = up/−y)
   */
  getAimAngle(originX, originY) {
    const pointer = this._scene.input.activePointer;
    const cam     = this._scene.cameras.main;
    // Convert screen-space pointer to world-space coordinates
    const wx      = pointer.x + cam.scrollX;
    const wy      = pointer.y + cam.scrollY;
    return Math.atan2(wx - originX, -(wy - originY));
  }

  _fromKeyboard() {
    let m = 0;
    const k = this._keys;
    const pointer = this._scene.input.activePointer;

    if (k.up.isDown    || k.w.isDown)     m |= INPUT.THRUST;
    if (k.left.isDown  || k.a.isDown)     m |= INPUT.ROTATE_LEFT;
    if (k.right.isDown || k.d.isDown)     m |= INPUT.ROTATE_RIGHT;
    if (k.space.isDown || pointer.leftButtonDown())  m |= INPUT.FIRE;
    if (k.shift.isDown)                   m |= INPUT.SHIELD;
    if (k.down.isDown  || k.s.isDown)     m |= INPUT.REVERSE;

    return m;
  }

  destroy() {
    for (const key of Object.values(this._keys)) key.destroy();
  }
}
