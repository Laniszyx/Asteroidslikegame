import { PhysicsBody } from '../physics/PhysicsBody.js';
import {
  SHIP_RADIUS, DRAG, THRUST, ROTATE_SPEED, MAX_SPEED,
  INPUT, COLOR, SHIELD_MAX_HP, SHIELD_REGEN, WORLD_WIDTH, WORLD_HEIGHT,
} from '../config.js';
import { WeaponFSM, WEAPON_TYPE } from '../systems/WeaponFSM.js';

let _nextId = 1;

export class Ship {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [angle=0]
   * @param {boolean} [isPlayer=true]
   */
  constructor(x, y, angle = 0, isPlayer = true) {
    this.id       = _nextId++;
    this.body     = new PhysicsBody(x, y, angle);
    this.body.radius = SHIP_RADIUS;
    this.isPlayer = isPlayer;
    this.alive    = true;
    this.lives    = 3;

    // Expose flat coords for CollisionSystem compatibility
    this._sync();

    // Weapon
    this.weapon   = new WeaponFSM(WEAPON_TYPE.LASER);

    // Shield
    this.shieldHP   = 0;
    this.shieldOn   = false;

    // Invincibility timer – starts at 3 s so asteroids can't instantly kill on spawn
    this.invincible = 3;

    // Rapid-fire boost
    this.rapidFire  = 0;

    // Aim angle (mouse-driven, defaults to ship heading)
    this.aimAngle   = angle;

    // Thrust / exhaust visual state
    this.thrusting  = false;

    // Railgun beam (position of last railgun shot for rendering)
    this.railgunBeam = null;
    this.railgunTimer = 0;
  }

  // ─── Sync flat properties from PhysicsBody ────────────────────────────────
  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.vx     = this.body.vx;
    this.vy     = this.body.vy;
    this.angle  = this.body.angle;
    this.radius = this.body.radius;
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  /**
   * @param {number} dt            seconds
   * @param {number} inputMask     bitmask
   * @param {Function} onFire      callback(ship) → void
   */
  update(dt, inputMask, onFire) {
    if (!this.alive) return;

    const body = this.body;

    // Rotation
    if (inputMask & INPUT.ROTATE_LEFT)  body.rotate(-ROTATE_SPEED, dt);
    if (inputMask & INPUT.ROTATE_RIGHT) body.rotate( ROTATE_SPEED, dt);

    // Thrust
    this.thrusting = !!(inputMask & INPUT.THRUST);
    if (this.thrusting) body.applyThrust(THRUST, dt, DRAG, MAX_SPEED);

    // Reverse (weaker backward thrust)
    if (inputMask & INPUT.REVERSE) body.applyThrust(-THRUST * 0.6, dt, DRAG, MAX_SPEED);

    // Integrate
    body.integrate(dt, DRAG, MAX_SPEED);
    this._sync();

    // Shield
    this.shieldOn = !!(inputMask & INPUT.SHIELD) && this.shieldHP > 0;
    if (this.shieldOn)  this.shieldHP = Math.max(0, this.shieldHP - 60 * dt);
    else                this.shieldHP = Math.min(SHIELD_MAX_HP, this.shieldHP + SHIELD_REGEN * dt);

    // Weapon – rapid-fire boost shortens cooldown externally
    const fire = !!(inputMask & INPUT.FIRE);
    if (this.weapon.update(dt, fire) && onFire) onFire(this);

    // Timers
    if (this.invincible > 0)  this.invincible  -= dt;
    if (this.rapidFire  > 0)  this.rapidFire   -= dt;
    if (this.railgunTimer > 0) {
      this.railgunTimer -= dt;
      if (this.railgunTimer <= 0) this.railgunBeam = null;
    }
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────

  /**
   * Draw procedural ship geometry via NeonRenderer.
   * @param {import('../rendering/NeonRenderer.js').NeonRenderer} nr
   */
  draw(nr) {
    if (!this.alive) return;

    const { x, y, angle } = this;

    // Blink during invincibility
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const cos = Math.cos(angle), sin = Math.sin(angle);
    const rot = (lx, ly) => ({
      x: x + cos * ly + sin * lx,  // rotated around ship origin
      y: y - sin * ly + cos * lx,
    });

    // Ship triangle (pointing up = −y)
    const nose  = rot(0,    -SHIP_RADIUS - 2);
    const left  = rot(-10,   SHIP_RADIUS - 2);
    const right = rot( 10,   SHIP_RADIUS - 2);
    const notch = rot(0,     SHIP_RADIUS - 7);

    nr.polygon([nose, left, notch, right], COLOR.SHIP, 1.5);

    // Exhaust flame
    if (this.thrusting) {
      const fl1 = rot(-5,  SHIP_RADIUS + 2 + Math.random() * 8);
      const fl2 = rot( 5,  SHIP_RADIUS + 2 + Math.random() * 8);
      const flt = rot( 0,  SHIP_RADIUS - 2);
      nr.polygon([flt, fl1, fl2], 0xff6600, 1);
    }

    // Shield arc
    if (this.shieldOn) {
      nr.circle(x, y, SHIP_RADIUS + 8, COLOR.SHIELD, 1.5);
    }

    // Railgun charging halo
    if (this.weapon.isCharging) {
      const p = this.weapon.chargeProgress;
      nr.circle(x, y, SHIP_RADIUS * (1 + p), COLOR.RAILGUN, 1 + p * 3);
    }

    // Railgun beam
    if (this.railgunBeam) {
      const { ex, ey } = this.railgunBeam;
      nr.line(x, y, ex, ey, COLOR.RAILGUN, 2);
    }
  }

  // ─── State serialization ─────────────────────────────────────────────────

  toNetState(entityType) {
    return {
      id:    this.id,
      type:  entityType,
      x:     this.x,
      y:     this.y,
      vx:    this.vx,
      vy:    this.vy,
      angle: this.angle,
      flags: (this.alive ? 0x01 : 0) |
             (this.shieldOn ? 0x02 : 0) |
             (this.thrusting ? 0x04 : 0),
    };
  }

  /** Apply a network state snapshot. */
  applyNetState(state) {
    this.body.x     = state.x;
    this.body.y     = state.y;
    this.body.vx    = state.vx;
    this.body.vy    = state.vy;
    this.body.angle = state.angle;
    this._sync();
    this.alive     = !!(state.flags & 0x01);
    this.shieldOn  = !!(state.flags & 0x02);
    this.thrusting = !!(state.flags & 0x04);
  }

  respawn(x, y) {
    this.body.x     = x;
    this.body.y     = y;
    this.body.vx    = 0;
    this.body.vy    = 0;
    this.body.angle = 0;
    this._sync();
    this.alive      = true;
    this.invincible = 3;
    this.weapon.setType(WEAPON_TYPE.LASER);
  }
}
