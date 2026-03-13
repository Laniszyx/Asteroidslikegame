import { PhysicsBody } from '../physics/PhysicsBody.js';
import {
  UFO_SPEED, UFO_FIRE_RATE, COLOR, CANVAS_WIDTH, CANVAS_HEIGHT,
} from '../config.js';
import {
  seek, flee, avoidObstacles, wander, combineForces,
} from '../ai/SteeringBehaviors.js';

let _nextId = 600;

/** Helper: convert (vx,vy) to angle in radians */
function _velToAngle(vx, vy) { return Math.atan2(vx, -vy); }

export class UFO {
  /**
   * @param {'small'|'large'} variant
   * @param {number} x
   * @param {number} y
   */
  constructor(variant, x, y) {
    this.id      = _nextId++;
    this.variant = variant;  // 'large' = dumber, 'small' = aggressive
    this.body    = new PhysicsBody(x, y);
    this.body.radius = variant === 'large' ? 28 : 18;

    const spd = variant === 'small' ? UFO_SPEED * 1.4 : UFO_SPEED;
    this.body.vx = (Math.random() - 0.5) * spd;
    this.body.vy = (Math.random() - 0.5) * spd;

    this.alive        = true;
    this.fireTimer    = UFO_FIRE_RATE + Math.random();
    this.score        = variant === 'small' ? 1000 : 200;
    this._target      = null;  // Ship reference

    this._sync();
  }

  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.vx     = this.body.vx;
    this.vy     = this.body.vy;
    this.radius = this.body.radius;
    this.angle  = _velToAngle(this.vx, this.vy);
  }

  /**
   * @param {number}   dt
   * @param {object}   target    Ship or null
   * @param {Array}    obstacles Asteroid array
   * @param {Function} onFire    callback(ufo) → void
   */
  update(dt, target, obstacles, onFire) {
    if (!this.alive) return;

    this._target = target;
    const MAX_FORCE = UFO_SPEED * 4;

    // ── Steering ──────────────────────────────────────────────────────────
    const forces = [];

    if (target && target.alive) {
      if (this.variant === 'small') {
        // Aggressive: pursue player
        forces.push({ force: seek(this, target.x, target.y, UFO_SPEED, MAX_FORCE), weight: 1.4 });
      } else {
        // Large: wander + mild flee when player is close
        const distSq = this.body.distSq(target.body);
        if (distSq < 150 * 150) {
          forces.push({ force: flee(this, target.x, target.y, UFO_SPEED, MAX_FORCE), weight: 1.2 });
        } else {
          forces.push({ force: wander(this, MAX_FORCE), weight: 0.8 });
        }
      }
    } else {
      forces.push({ force: wander(this, MAX_FORCE), weight: 1 });
    }

    // Obstacle avoidance
    forces.push({ force: avoidObstacles(this, obstacles, MAX_FORCE * 0.8, 80), weight: 1.0 });

    const { ax, ay } = combineForces(forces);
    this.body.vx = Math.max(-UFO_SPEED * 1.5, Math.min(UFO_SPEED * 1.5, this.body.vx + ax * dt));
    this.body.vy = Math.max(-UFO_SPEED * 1.5, Math.min(UFO_SPEED * 1.5, this.body.vy + ay * dt));

    this.body.integrate(dt, 0.99, UFO_SPEED * 1.5);

    // ── Fire ──────────────────────────────────────────────────────────────
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && target && target.alive && onFire) {
      onFire(this);
      this.fireTimer = UFO_FIRE_RATE + Math.random() * 0.5;
    }

    this._sync();
  }

  draw(nr) {
    if (!this.alive) return;
    const { x, y, radius } = this;
    const h = radius * 0.55;

    // Saucer body: ellipse approximated with polygon
    const pts = [];
    const segs = 18;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push({ x: x + Math.cos(a) * radius, y: y + Math.sin(a) * h });
    }
    nr.polygon(pts, COLOR.UFO, 1.5);

    // Cockpit dome
    const domePts = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      domePts.push({ x: x + Math.cos(a) * radius * 0.45, y: y + Math.sin(a) * radius * 0.45 - h * 0.1 });
    }
    nr.polygon(domePts, COLOR.UFO, 1.2);
  }

  toNetState() {
    return {
      id: this.id, type: 3,
      x: this.x, y: this.y,
      vx: this.vx, vy: this.vy,
      angle: this.angle,
      flags: this.alive ? 1 : 0,
    };
  }
}
