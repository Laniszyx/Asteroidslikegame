import { Quadtree } from '../physics/Quadtree.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

/**
 * CollisionSystem – uses a Quadtree to efficiently detect circle–circle
 * collisions between heterogeneous entity groups.
 *
 * Usage each frame:
 *   cs.build(allEntities)
 *   const pairs = cs.query(bullets, asteroids)
 *   const hits  = cs.query(ships,   asteroids)
 */
export class CollisionSystem {
  constructor() {
    this._qt = new Quadtree({ x: 0, y: 0, w: CANVAS_WIDTH, h: CANVAS_HEIGHT });
  }

  /**
   * Rebuild the quadtree with the given entity array.
   * Each entity must have: { x, y, radius, alive, id }
   * @param {Array} entities
   */
  build(entities) {
    this._qt.clear();
    for (const e of entities) {
      if (e.alive) {
        this._qt.insert({ x: e.x, y: e.y, radius: e.radius || 1, ref: e });
      }
    }
  }

  /**
   * Test all entities in `setA` against `setB` for circle–circle collision.
   * Returns an array of [a, b] pairs.
   * @param {Array} setA
   * @param {Array} setB
   * @returns {Array<[object, object]>}
   */
  query(setA, setB) {
    const pairs = [];
    const seen  = new Set();

    for (const a of setA) {
      if (!a.alive) continue;
      const candidates = this._qt.retrieve({ x: a.x, y: a.y, radius: a.radius || 1 });

      for (const cand of candidates) {
        const b = cand.ref;
        if (!b.alive || b === a) continue;
        if (!setB.includes(b)) continue;

        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (a.collides ? a.collides(b) : _circleCircle(a, b)) {
          pairs.push([a, b]);
        }
      }
    }

    return pairs;
  }
}

function _circleCircle(a, b) {
  let dx = Math.abs(a.x - b.x);
  let dy = Math.abs(a.y - b.y);
  if (dx > CANVAS_WIDTH  / 2) dx = CANVAS_WIDTH  - dx;
  if (dy > CANVAS_HEIGHT / 2) dy = CANVAS_HEIGHT - dy;
  const dist2 = dx * dx + dy * dy;
  const rSum  = (a.radius || 0) + (b.radius || 0);
  return dist2 < rSum * rSum;
}
