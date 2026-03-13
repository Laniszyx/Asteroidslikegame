import { PhysicsBody } from '../physics/PhysicsBody.js';
import { ASTEROID_DEFS, COLOR, DRAG, MAX_SPEED, WORLD_WIDTH, WORLD_HEIGHT } from '../config.js';

let _nextId = 200;

/** Create a jagged polygon shape for an asteroid. */
function _makeShape(radius, nVerts = 10) {
  const pts = [];
  for (let i = 0; i < nVerts; i++) {
    const a = (i / nVerts) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.5);
    pts.push({ lx: Math.sin(a) * r, ly: -Math.cos(a) * r });
  }
  return pts;
}

export class Asteroid {
  /**
   * @param {'large'|'medium'|'small'} size
   * @param {number} x
   * @param {number} y
   * @param {number} [vx]
   * @param {number} [vy]
   */
  constructor(size, x, y, vx, vy) {
    this.id    = _nextId++;
    this.size  = size;
    const def  = ASTEROID_DEFS[size];
    this.score = def.score;

    this.body  = new PhysicsBody(x, y);
    this.body.radius = def.radius;

    // Random drift velocity if not specified
    const spd  = 30 + Math.random() * 60;
    const ang  = Math.random() * Math.PI * 2;
    this.body.vx = vx !== undefined ? vx : Math.sin(ang) * spd;
    this.body.vy = vy !== undefined ? vy : -Math.cos(ang) * spd;

    // Slow spin
    this.spin   = (Math.random() - 0.5) * 1.5;
    this.angle  = Math.random() * Math.PI * 2;

    this.alive  = true;
    this._shape = _makeShape(def.radius);

    this._sync();
  }

  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.vx     = this.body.vx;
    this.vy     = this.body.vy;
    this.radius = this.body.radius;
  }

  update(dt) {
    if (!this.alive) return;
    this.body.integrate(dt, 1.0, MAX_SPEED);  // no drag on asteroids
    this.angle += this.spin * dt;
    this._sync();
  }

  draw(nr) {
    if (!this.alive) return;
    const { x, y, angle } = this;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const pts = this._shape.map(({ lx, ly }) => ({
      x: x + cos * ly + sin * lx,
      y: y - sin * ly + cos * lx,
    }));

    nr.polygon(pts, COLOR.ASTEROID, 1.5);

    // Ghost replicas across edges
    for (const ghost of this.body.ghosts()) {
      if (ghost.x === x && ghost.y === y) continue;
      const gpts = this._shape.map(({ lx, ly }) => ({
        x: ghost.x + cos * ly + sin * lx,
        y: ghost.y - sin * ly + cos * lx,
      }));
      nr.polygon(gpts, COLOR.ASTEROID, 1);
    }
  }

  /** Split this asteroid into smaller pieces; returns new Asteroid array. */
  split() {
    this.alive = false;
    const def  = ASTEROID_DEFS[this.size];
    if (!def.splits) return [];

    const frags = [];
    for (let i = 0; i < def.count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 80;
      frags.push(new Asteroid(
        def.splits,
        this.x + Math.sin(ang) * def.radius * 0.5,
        this.y - Math.cos(ang) * def.radius * 0.5,
        this.vx + Math.sin(ang) * spd,
        this.vy - Math.cos(ang) * spd,
      ));
    }
    return frags;
  }

  toNetState() {
    return {
      id: this.id, type: 1,
      x: this.x, y: this.y,
      vx: this.vx, vy: this.vy,
      angle: this.angle,
      flags: this.alive ? 1 : 0,
    };
  }
}

/**
 * Spawn a wave of large asteroids, avoiding the centre (safe zone).
 * @param {number} count
 * @param {number} safeX
 * @param {number} safeY
 * @param {number} safeRadius
 * @returns {Asteroid[]}
 */
export function spawnWave(count, safeX, safeY, safeRadius = 100) {
  const asteroids = [];
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = Math.random() * WORLD_WIDTH;
      y = Math.random() * WORLD_HEIGHT;
    } while (Math.hypot(x - safeX, y - safeY) < safeRadius);
    asteroids.push(new Asteroid('large', x, y));
  }
  return asteroids;
}
