import Phaser from 'phaser';
import { COLOR } from '../config.js';

/**
 * NeonRenderer – thin wrapper around Phaser.GameObjects.Graphics that provides
 * helpers for drawing procedural neon geometry with glow halos.
 */
export class NeonRenderer {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {Phaser.GameObjects.Graphics} */
    this.gfx = scene.add.graphics();
    // second, slightly larger pass for glow halo
    /** @type {Phaser.GameObjects.Graphics} */
    this.glow = scene.add.graphics();
    this.glow.setAlpha(0.18);
    this.glow.setDepth(-1);
  }

  /** Clear both layers */
  clear() {
    this.gfx.clear();
    this.glow.clear();
  }

  /**
   * Draw a line with neon glow halo.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} color  hex color
   * @param {number} [width=1.5]
   */
  line(x1, y1, x2, y2, color = COLOR.SHIP, width = 1.5) {
    this.gfx.lineStyle(width, color, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(x1, y1);
    this.gfx.lineTo(x2, y2);
    this.gfx.strokePath();

    // halo
    this.glow.lineStyle(width * 5, color, 1);
    this.glow.beginPath();
    this.glow.moveTo(x1, y1);
    this.glow.lineTo(x2, y2);
    this.glow.strokePath();
  }

  /**
   * Draw a polygon (array of {x,y}) with neon glow.
   * @param {Array<{x:number,y:number}>} pts
   * @param {number} color
   * @param {number} [width=1.5]
   */
  polygon(pts, color = COLOR.SHIP, width = 1.5) {
    if (pts.length < 2) return;
    this.gfx.lineStyle(width, color, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) this.gfx.lineTo(pts[i].x, pts[i].y);
    this.gfx.closePath();
    this.gfx.strokePath();

    this.glow.lineStyle(width * 5, color, 1);
    this.glow.beginPath();
    this.glow.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) this.glow.lineTo(pts[i].x, pts[i].y);
    this.glow.closePath();
    this.glow.strokePath();
  }

  /**
   * Draw a circle outline with neon glow.
   */
  circle(x, y, r, color = COLOR.SHIP, width = 1.5) {
    this.gfx.lineStyle(width, color, 1);
    this.gfx.strokeCircle(x, y, r);

    this.glow.lineStyle(width * 5, color, 1);
    this.glow.strokeCircle(x, y, r);
  }

  /**
   * Draw a filled circle (for bullets / particles).
   */
  dot(x, y, r, color = COLOR.BULLET) {
    this.gfx.fillStyle(color, 1);
    this.gfx.fillCircle(x, y, r);

    this.glow.fillStyle(color, 1);
    this.glow.fillCircle(x, y, r * 3);
  }

  destroy() {
    this.gfx.destroy();
    this.glow.destroy();
  }
}
