import { PhysicsBody } from '../physics/PhysicsBody.js';
import { BULLET_SPEED, BULLET_TTL, COLOR } from '../config.js';

let _nextId = 400;

export class Bullet {
  constructor() {
    this.id   = 0;
    this.body = new PhysicsBody(0, 0);
    this.body.radius = 3;
    this.alive  = false;
    this.ttl    = 0;
    this.owner  = null;   // Ship reference
    this.isRailgun = false;
    this._sync();
  }

  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.vx     = this.body.vx;
    this.vy     = this.body.vy;
    this.radius = this.body.radius;
  }

  /**
   * Activate / reset this pooled bullet.
   * @param {number} x
   * @param {number} y
   * @param {number} angle  heading of shooter (radians)
   * @param {object} owner
   * @param {boolean} [railgun=false]
   */
  activate(x, y, angle, owner, railgun = false) {
    this.id       = _nextId++;
    this.alive    = true;
    this.ttl      = BULLET_TTL;
    this.owner    = owner;
    this.isRailgun = railgun;

    this.body.x     = x;
    this.body.y     = y;
    this.body.angle = angle;

    const spd = BULLET_SPEED + (owner ? Math.hypot(owner.vx, owner.vy) * 0.4 : 0);
    this.body.vx = Math.sin(angle) * spd + (owner?.vx || 0) * 0.2;
    this.body.vy = -Math.cos(angle) * spd + (owner?.vy || 0) * 0.2;

    this.body.radius = railgun ? 5 : 3;
    this._sync();
  }

  update(dt) {
    if (!this.alive) return;
    this.body.integrate(dt, 1.0, BULLET_SPEED * 2);
    this._sync();
    this.ttl -= dt;
    if (this.ttl <= 0) this.alive = false;
  }

  draw(nr) {
    if (!this.alive) return;
    const col = this.isRailgun ? COLOR.RAILGUN : COLOR.BULLET;
    nr.dot(this.x, this.y, this.body.radius * 1.5, col);
  }

  toNetState() {
    return {
      id: this.id, type: 2,
      x: this.x, y: this.y,
      vx: this.vx, vy: this.vy,
      angle: this.body.angle,
      flags: this.alive ? 1 : 0,
    };
  }
}
