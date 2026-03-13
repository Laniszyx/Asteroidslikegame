/**
 * Quadtree – spatial partitioning for O(N log N) collision / AI queries.
 * Cells subdivide when they hold more than MAX_OBJECTS and depth < MAX_DEPTH.
 */

const MAX_OBJECTS = 6;
const MAX_DEPTH   = 6;

export class Quadtree {
  /**
   * @param {{ x:number, y:number, w:number, h:number }} bounds
   * @param {number} [depth=0]
   */
  constructor(bounds, depth = 0) {
    this.bounds   = bounds;
    this.depth    = depth;
    this.objects  = [];   // {x, y, radius, ref}
    this.children = null; // [NE, NW, SW, SE]
  }

  clear() {
    this.objects  = [];
    this.children = null;
  }

  /** Insert an object with x, y, radius, and a ref back-pointer. */
  insert(obj) {
    if (!this._inBounds(obj)) return;

    if (this.children) {
      this._insertChildren(obj);
      return;
    }

    this.objects.push(obj);

    if (this.objects.length > MAX_OBJECTS && this.depth < MAX_DEPTH) {
      this._subdivide();
      const old = this.objects;
      this.objects = [];
      for (const o of old) this._insertChildren(o);
    }
  }

  /**
   * Retrieve all objects that could collide with `obj` (same or adjacent cells).
   * @param {{ x:number, y:number, radius:number }} obj
   * @returns {Array}
   */
  retrieve(obj) {
    const found = [];
    this._retrieve(obj, found);
    return found;
  }

  _retrieve(obj, found) {
    if (!this._overlaps(obj)) return;

    for (const o of this.objects) found.push(o);

    if (this.children) {
      for (const c of this.children) c._retrieve(obj, found);
    }
  }

  _inBounds(obj) {
    return (
      obj.x + obj.radius >= this.bounds.x &&
      obj.x - obj.radius <= this.bounds.x + this.bounds.w &&
      obj.y + obj.radius >= this.bounds.y &&
      obj.y - obj.radius <= this.bounds.y + this.bounds.h
    );
  }

  _overlaps(obj) {
    return this._inBounds(obj);
  }

  _insertChildren(obj) {
    for (const c of this.children) {
      if (c._inBounds(obj)) {
        c.insert(obj);
        return;
      }
    }
    // Straddles multiple quads – keep at this level
    this.objects.push(obj);
  }

  _subdivide() {
    const { x, y, w, h } = this.bounds;
    const hw = w / 2, hh = h / 2;
    const d  = this.depth + 1;
    this.children = [
      new Quadtree({ x: x + hw, y: y,      w: hw, h: hh }, d), // NE
      new Quadtree({ x: x,      y: y,      w: hw, h: hh }, d), // NW
      new Quadtree({ x: x,      y: y + hh, w: hw, h: hh }, d), // SW
      new Quadtree({ x: x + hw, y: y + hh, w: hw, h: hh }, d), // SE
    ];
  }
}
