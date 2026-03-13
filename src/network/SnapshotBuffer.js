import { SNAPSHOT_DELAY_MS } from '../config.js';

/**
 * SnapshotBuffer – stores a time-indexed ring of authoritative state snapshots
 * for Client-Side Interpolation and Host-Side Lag-Compensated Hit Detection.
 *
 * All timestamps are performance.now() values in milliseconds.
 */
export class SnapshotBuffer {
  /**
   * @param {number} [maxMs=600]  total history window to keep
   */
  constructor(maxMs = 600) {
    this.maxMs     = maxMs;
    /** @type {Array<{time:number, tick:number, entities:Map<number,object>}>} */
    this._snapshots = [];
  }

  /**
   * Push a new snapshot into the buffer.
   * @param {number}              tick
   * @param {Array<{id:number}>}  entities  decoded entity array
   */
  push(tick, entities) {
    const time    = performance.now();
    const entMap  = new Map();
    for (const e of entities) entMap.set(e.id, { ...e });

    this._snapshots.push({ time, tick, entities: entMap });

    // Prune old entries
    const cutoff = time - this.maxMs;
    while (this._snapshots.length > 2 && this._snapshots[0].time < cutoff) {
      this._snapshots.shift();
    }
  }

  /**
   * Get linearly-interpolated entity state at the render time
   * (current time − SNAPSHOT_DELAY_MS) for Client-Side Prediction display.
   *
   * @returns {Map<number, object>}  entity id → interpolated state
   */
  getInterpolated() {
    const renderTime = performance.now() - SNAPSHOT_DELAY_MS;
    return this._interpolateAt(renderTime);
  }

  /**
   * Rewind the buffer to a specific host time (for lag-compensated hit detection).
   * @param {number} targetTime   ms (performance.now()-based)
   * @returns {Map<number, object>}
   */
  rewindTo(targetTime) {
    return this._interpolateAt(targetTime);
  }

  /**
   * Find the two snapshots bracketing `targetTime` and lerp.
   * @param {number} targetTime
   * @returns {Map<number, object>}
   */
  _interpolateAt(targetTime) {
    const snaps = this._snapshots;
    if (!snaps.length) return new Map();

    // Find the pair
    let lo = snaps[0], hi = snaps[snaps.length - 1];

    if (targetTime <= lo.time) return new Map(lo.entities);
    if (targetTime >= hi.time) return new Map(hi.entities);

    for (let i = 1; i < snaps.length; i++) {
      if (snaps[i].time >= targetTime) {
        lo = snaps[i - 1];
        hi = snaps[i];
        break;
      }
    }

    const t = (targetTime - lo.time) / (hi.time - lo.time);
    const result = new Map();

    // Union of entity ids in both snapshots
    const ids = new Set([...lo.entities.keys(), ...hi.entities.keys()]);

    for (const id of ids) {
      const a = lo.entities.get(id);
      const b = hi.entities.get(id);

      if (!a || !b) {
        // entity appeared/disappeared – show the one that exists
        result.set(id, a || b);
        continue;
      }

      result.set(id, {
        id:    id,
        type:  b.type,
        x:     _lerp(a.x,  b.x,  t),
        y:     _lerp(a.y,  b.y,  t),
        vx:    _lerp(a.vx, b.vx, t),
        vy:    _lerp(a.vy, b.vy, t),
        angle: _lerpAngle(a.angle, b.angle, t),
        flags: b.flags,
      });
    }

    return result;
  }

  /** The most recent raw snapshot. */
  latest() {
    return this._snapshots[this._snapshots.length - 1] || null;
  }
}

function _lerp(a, b, t) { return a + (b - a) * t; }

function _lerpAngle(a, b, t) {
  // Shortest-path angular interpolation
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + diff * t;
}
