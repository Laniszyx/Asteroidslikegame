import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

/**
 * PhysicsBody – semi-implicit Euler integration with drag & toroidal wrapping.
 */
export class PhysicsBody {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [angle=0]   radians
   */
  constructor(x, y, angle = 0) {
    this.x   = x;
    this.y   = y;
    this.vx  = 0;
    this.vy  = 0;
    this.angle = angle;   // radians, 0 = up (−y)
    this.radius = 0;
    this.alive  = true;
  }

  /**
   * Apply thrust along the body's current heading (semi-implicit Euler).
   * @param {number} thrust   pixels/s²
   * @param {number} dt       seconds
   * @param {number} drag     [0,1] multiplier applied after velocity update
   * @param {number} maxSpeed pixels/s
   */
  applyThrust(thrust, dt, drag, maxSpeed) {
    // heading vector: 0 = "up" (−y), so sin for x, −cos for y
    this.vx += Math.sin(this.angle) * thrust * dt;
    this.vy -= Math.cos(this.angle) * thrust * dt;
    this._clampSpeed(maxSpeed);
  }

  /** Rotate the body.
   * @param {number} omega  radians/s (positive = clockwise)
   * @param {number} dt
   */
  rotate(omega, dt) {
    this.angle += omega * dt;
  }

  /**
   * Integrate position using current velocity, apply drag, wrap toroidally.
   * @param {number} dt     seconds
   * @param {number} drag   per-frame drag coefficient
   * @param {number} maxSpeed
   */
  integrate(dt, drag, maxSpeed) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Apply drag
    this.vx *= drag;
    this.vy *= drag;

    this._clampSpeed(maxSpeed);
    this._wrap();
  }

  _clampSpeed(max) {
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > max) {
      const inv = max / spd;
      this.vx *= inv;
      this.vy *= inv;
    }
  }

  /**
   * Toroidal wrap – seamless screen edge crossing.
   */
  _wrap() {
    if (this.x < 0)             this.x += CANVAS_WIDTH;
    if (this.x > CANVAS_WIDTH)  this.x -= CANVAS_WIDTH;
    if (this.y < 0)             this.y += CANVAS_HEIGHT;
    if (this.y > CANVAS_HEIGHT) this.y -= CANVAS_HEIGHT;
  }

  /**
   * Toroidal distance²  (shortest-path across wrapped boundaries).
   * @param {PhysicsBody} other
   * @returns {number}
   */
  distSq(other) {
    let dx = Math.abs(this.x - other.x);
    let dy = Math.abs(this.y - other.y);
    if (dx > CANVAS_WIDTH  / 2) dx = CANVAS_WIDTH  - dx;
    if (dy > CANVAS_HEIGHT / 2) dy = CANVAS_HEIGHT - dy;
    return dx * dx + dy * dy;
  }

  /**
   * Circle–circle collision test (toroidal).
   * @param {PhysicsBody} other
   * @returns {boolean}
   */
  collides(other) {
    const minDist = this.radius + other.radius;
    return this.distSq(other) < minDist * minDist;
  }

  /**
   * Ghost replica positions for cross-boundary rendering.
   * Returns up to 4 ghost positions (plus original) needed to handle
   * objects straddling a screen edge.
   * @returns {Array<{x:number,y:number}>}
   */
  ghosts() {
    const out = [{ x: this.x, y: this.y }];
    const r   = this.radius;
    if (this.x - r < 0)            out.push({ x: this.x + CANVAS_WIDTH,  y: this.y });
    if (this.x + r > CANVAS_WIDTH) out.push({ x: this.x - CANVAS_WIDTH,  y: this.y });
    if (this.y - r < 0)            out.push({ x: this.x,                  y: this.y + CANVAS_HEIGHT });
    if (this.y + r > CANVAS_HEIGHT)out.push({ x: this.x,                  y: this.y - CANVAS_HEIGHT });
    return out;
  }
}
