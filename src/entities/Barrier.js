import { PhysicsBody } from '../physics/PhysicsBody.js';
import { WORLD_WIDTH, WORLD_HEIGHT, COLOR } from '../config.js';
import { ENTITY_TYPE } from '../network/Serializer.js';

let _nextId = 1500;

// Fill colour for barrier interior
const BARRIER_FILL = 0x112222;

/**
 * Generate a convex polygon shape for a barrier.
 * @param {number} w  half-width
 * @param {number} h  half-height
 * @param {number} nVerts
 * @returns {Array<{lx:number,ly:number}>}
 */
function _makeShape(w, h, nVerts = 6) {
  const pts = [];
  for (let i = 0; i < nVerts; i++) {
    const a = (i / nVerts) * Math.PI * 2;
    const jitter = 0.85 + Math.random() * 0.3;
    pts.push({
      lx: Math.sin(a) * w * jitter,
      ly: -Math.cos(a) * h * jitter,
    });
  }
  return pts;
}

/**
 * Barrier – indestructible cover object.
 * Bullets are absorbed on contact, ships and asteroids bounce off.
 */
export class Barrier {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [size=1]  1=small, 2=medium, 3=large
   */
  constructor(x, y, size = 1) {
    this.id   = _nextId++;
    this.body = new PhysicsBody(x, y);

    // Determine dimensions based on size
    const scale = [1, 1.5, 2.2][size - 1] || 1;
    const baseR = 30 * scale;
    this.body.radius = baseR;

    this.alive  = true;
    this.angle  = Math.random() * Math.PI * 2;

    // Barrier is static – no velocity
    this.body.vx = 0;
    this.body.vy = 0;

    this._shape = _makeShape(baseR, baseR * 0.8, 5 + Math.floor(Math.random() * 4));
    this._color = COLOR.BARRIER;
    this._sync();
  }

  _sync() {
    this.x      = this.body.x;
    this.y      = this.body.y;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = this.body.radius;
  }

  update(_dt) {
    // Barriers are static – no physics integration needed
  }

  draw(nr) {
    if (!this.alive) return;
    const { x, y, angle } = this;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const pts = this._shape.map(({ lx, ly }) => ({
      x: x + cos * ly + sin * lx,
      y: y - sin * ly + cos * lx,
    }));

    // Draw filled background (dark) then outline
    nr.gfx.fillStyle(BARRIER_FILL, 0.6);
    nr.gfx.beginPath();
    nr.gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) nr.gfx.lineTo(pts[i].x, pts[i].y);
    nr.gfx.closePath();
    nr.gfx.fillPath();

    // Outline with neon glow
    nr.polygon(pts, this._color, 1.5);

    // Cross-hatch marks to indicate it's indestructible
    const cx = x, cy = y;
    const r = this.radius * 0.3;
    nr.line(cx - r, cy - r, cx + r, cy + r, this._color, 0.5);
    nr.line(cx + r, cy - r, cx - r, cy + r, this._color, 0.5);
  }

  toNetState() {
    return {
      id: this.id, type: ENTITY_TYPE.BARRIER,
      x: this.x, y: this.y,
      vx: 0, vy: 0,
      angle: this.angle,
      flags: this.alive ? 1 : 0,
    };
  }
}

/**
 * Spawn barriers for a level, avoiding player safe zone.
 * @param {number} count
 * @param {number} safeX
 * @param {number} safeY
 * @param {number} [safeRadius=200]
 * @returns {Barrier[]}
 */
export function spawnBarriers(count, safeX, safeY, safeRadius = 200) {
  const barriers = [];
  for (let i = 0; i < count; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = Math.random() * WORLD_WIDTH;
      y = Math.random() * WORLD_HEIGHT;
      attempts++;
    } while (Math.hypot(x - safeX, y - safeY) < safeRadius && attempts < 100);

    const size = 1 + Math.floor(Math.random() * 3); // 1-3
    barriers.push(new Barrier(x, y, size));
  }
  return barriers;
}
