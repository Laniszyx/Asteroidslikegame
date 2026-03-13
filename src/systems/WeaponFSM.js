/**
 * WeaponFSM – Hierarchical Finite State Machine for weapon states.
 *
 * States:  IDLE → CHARGING → FIRING → COOLDOWN → IDLE
 * The standard laser fires immediately (no charge); the Railgun has a charge phase.
 */

export const WPN_STATE = {
  IDLE:     'idle',
  CHARGING: 'charging',
  FIRING:   'firing',
  COOLDOWN: 'cooldown',
};

export const WEAPON_TYPE = {
  LASER:    'laser',
  RAILGUN:  'railgun',
  SPREAD:   'spread',
};

const WEAPON_DEFS = {
  laser: {
    chargeTime:   0,
    firingTime:   0.06,
    cooldown:     0.18,
  },
  railgun: {
    chargeTime:   0.5,
    firingTime:   0.08,
    cooldown:     3.0,
  },
  spread: {
    chargeTime:   0,
    firingTime:   0.06,
    cooldown:     0.30,
  },
};

export class WeaponFSM {
  constructor(type = WEAPON_TYPE.LASER) {
    this.type     = type;
    this._def     = WEAPON_DEFS[type];
    this.state    = WPN_STATE.IDLE;
    this._timer   = 0;
    this.firedThisFrame = false;
  }

  /** Switch weapon type (resets to IDLE). */
  setType(type) {
    this.type   = type;
    this._def   = WEAPON_DEFS[type];
    this.state  = WPN_STATE.IDLE;
    this._timer = 0;
  }

  /**
   * Update FSM.
   * @param {number}  dt         seconds
   * @param {boolean} fireHeld   whether the fire input is held
   * @returns {boolean}          true on the frame a shot should be spawned
   */
  update(dt, fireHeld) {
    this.firedThisFrame = false;
    this._timer = Math.max(0, this._timer - dt);

    switch (this.state) {
      case WPN_STATE.IDLE:
        if (fireHeld) {
          if (this._def.chargeTime > 0) {
            this.state  = WPN_STATE.CHARGING;
            this._timer = this._def.chargeTime;
          } else {
            this.state  = WPN_STATE.FIRING;
            this._timer = this._def.firingTime;
          }
        }
        break;

      case WPN_STATE.CHARGING:
        if (this._timer <= 0) {
          this.state  = WPN_STATE.FIRING;
          this._timer = this._def.firingTime;
        }
        break;

      case WPN_STATE.FIRING:
        this.firedThisFrame = true;
        this.state  = WPN_STATE.COOLDOWN;
        this._timer = this._def.cooldown;
        break;

      case WPN_STATE.COOLDOWN:
        if (this._timer <= 0) {
          this.state = WPN_STATE.IDLE;
        }
        break;
    }

    return this.firedThisFrame;
  }

  /** Is the weapon currently charging (visual feedback cue)? */
  get isCharging() { return this.state === WPN_STATE.CHARGING; }

  /** Charge progress [0,1]. */
  get chargeProgress() {
    if (!this.isCharging || !this._def.chargeTime) return 0;
    return 1 - (this._timer / this._def.chargeTime);
  }

  /** Force into cooldown (e.g. after being hit). */
  interrupt() {
    this.state  = WPN_STATE.COOLDOWN;
    this._timer = this._def.cooldown * 0.5;
  }
}
