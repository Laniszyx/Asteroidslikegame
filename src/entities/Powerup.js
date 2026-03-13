import { PhysicsBody } from '../physics/PhysicsBody.js';
import { COLOR, DDA_DROP_TABLE } from '../config.js';

let _nextId = 1000;

const POWERUP_DEFS = {
  shield_restore: { color: COLOR.SHIELD,    label: 'S', ttl: 12 },
  rapid_fire:     { color: 0xffaa00,        label: 'R', ttl: 12 },
  railgun:        { color: COLOR.RAILGUN,   label: 'G', ttl: 12 },
  black_hole:     { color: COLOR.BLACK_HOLE,label: 'B', ttl: 12 },
};

export class Powerup {
  /**
   * @param {string} type    one of the keys in POWERUP_DEFS
   * @param {number} x
   * @param {number} y
   */
  constructor(type, x, y) {
    this.id   = _nextId++;
    this.type = type;
    const def = POWERUP_DEFS[type];
    this._color = def.color;
    this._label = def.label;
    this.ttl    = def.ttl;

    this.body   = new PhysicsBody(x, y);
    this.body.radius = 12;
    this.alive  = true;
    this._pulse = Math.random() * Math.PI * 2;
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
    this._pulse += dt * 2.5;
    if (this.ttl <= 0) this.alive = false;
  }

  draw(nr) {
    if (!this.alive) return;
    const scale = 1 + Math.sin(this._pulse) * 0.15;
    const r = this.body.radius * scale;
    nr.circle(this.x, this.y, r,     this._color, 1.5);
    nr.circle(this.x, this.y, r * 1.4, this._color, 0.5);
  }

  toNetState() {
    return {
      id: this.id, type: 5,
      x: this.x, y: this.y,
      vx: 0, vy: 0,
      angle: 0,
      flags: this.alive ? 1 : 0,
    };
  }
}

/**
 * Dynamic Difficulty Adjustment – choose a powerup type weighted by
 * game state (low health / many asteroids → bias toward defensive).
 *
 * @param {{ shieldHP:number, lives:number }} player
 * @param {number} asteroidCount
 * @returns {string}  powerup type key
 */
export function ddaDrop(player, asteroidCount) {
  // Build weighted table with contextual modifiers
  const table = DDA_DROP_TABLE.map(entry => {
    let w = entry.weight;
    if (entry.type === 'shield_restore') {
      // Bias toward shield if health is low
      const healthRatio = (player.shieldHP || 0) / 100;
      w += (1 - healthRatio) * 4;
    }
    if (entry.type === 'black_hole' && asteroidCount > 8) {
      w += 2;  // More useful when crowded
    }
    return { type: entry.type, w };
  });

  const total = table.reduce((s, t) => s + t.w, 0);
  let rng = Math.random() * total;
  for (const entry of table) {
    rng -= entry.w;
    if (rng <= 0) return entry.type;
  }
  return table[0].type;
}
