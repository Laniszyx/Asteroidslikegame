/**
 * ObjectPool – recycles instances to avoid GC pressure for bullets / particles.
 *
 * @template T
 */
export class ObjectPool {
  /**
   * @param {() => T}    factory    Creates a new instance
   * @param {(obj:T)=>void} reset   Resets a recycled instance before reuse
   * @param {number}     [initialSize=32]
   */
  constructor(factory, reset, initialSize = 32) {
    this._factory = factory;
    this._reset   = reset;
    this._free    = [];
    this.active   = new Set();

    // Pre-warm
    for (let i = 0; i < initialSize; i++) {
      this._free.push(factory());
    }
  }

  /** Obtain an object (from pool or newly created). */
  acquire() {
    const obj = this._free.length ? this._free.pop() : this._factory();
    this._reset(obj);
    this.active.add(obj);
    return obj;
  }

  /** Return an object to the pool. */
  release(obj) {
    if (this.active.delete(obj)) {
      this._free.push(obj);
    }
  }

  /** Release all active objects at once. */
  releaseAll() {
    for (const obj of this.active) this._free.push(obj);
    this.active.clear();
  }

  get activeCount() { return this.active.size; }
  get freeCount()   { return this._free.length; }
}
