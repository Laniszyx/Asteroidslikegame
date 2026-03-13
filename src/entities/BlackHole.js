import { PhysicsBody } from '../physics/PhysicsBody.js';
import { COLOR, WORLD_WIDTH, WORLD_HEIGHT } from '../config.js';

let _nextId = 800;

// Gravitational constant for black-hole pull
const G = 18000;

export class BlackHole {
  constructor(x, y) {
    this.id     = _nextId++;
    this.body   = new PhysicsBody(x, y);
    this.body.radius = 22;
    this.alive  = true;
    this.ttl    = 6;       // seconds before it dissipates
    this._pulse = 0;       // animation timer

    this._sync();
  }

  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.radius = this.body.radius;
  }

  update(dt) {
    if (!this.alive) return;
    this.ttl    -= dt;
    this._pulse += dt * 3;
    if (this.ttl <= 0) this.alive = false;
    this._sync();
  }

  /**
   * Apply gravitational pull to an entity with a body.
   * F = G / r²  (Newton's law of universal gravitation, simplified mass=1)
   * @param {{ body: PhysicsBody, alive: boolean }} entity
   * @param {number} dt
   */
  attract(entity, dt) {
    if (!this.alive || !entity.alive) return;

    const body = entity.body;
    let dx = this.x - body.x;
    let dy = this.y - body.y;

    // Toroidal shortest path
    if (Math.abs(dx) > WORLD_WIDTH  / 2) dx -= Math.sign(dx) * WORLD_WIDTH;
    if (Math.abs(dy) > WORLD_HEIGHT / 2) dy -= Math.sign(dy) * WORLD_HEIGHT;

    const distSq = dx * dx + dy * dy;
    if (distSq < 1) return;

    const force = G / distSq;
    const dist  = Math.sqrt(distSq);
    body.vx += (dx / dist) * force * dt;
    body.vy += (dy / dist) * force * dt;
  }

  draw(nr) {
    if (!this.alive) return;
    const { x, y } = this;
    const r  = this.body.radius;
    const p  = this._pulse;

    // Pulsing rings
    for (let i = 0; i < 3; i++) {
      const ringR = r * (1 + i * 0.55 + Math.sin(p + i) * 0.1);
      const alpha = 0.8 - i * 0.2;
      nr.gfx.lineStyle(1.5, COLOR.BLACK_HOLE, alpha);
      nr.gfx.strokeCircle(x, y, ringR);
    }

    // Dark core (filled)
    nr.gfx.fillStyle(0x000000, 1);
    nr.gfx.fillCircle(x, y, r * 0.6);

    // Event horizon glow
    nr.circle(x, y, r * 0.6, COLOR.BLACK_HOLE, 2);
  }

  toNetState() {
    return {
      id: this.id, type: 4,
      x: this.x, y: this.y,
      vx: 0, vy: 0,
      angle: 0,
      flags: this.alive ? 1 : 0,
    };
  }
}
