import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this._score   = data.score   ?? 0;
    this._hiScore = data.hiScore ?? 0;
    this._level   = data.level   ?? 1;
  }

  create() {
    const cx = CANVAS_WIDTH  / 2;
    const cy = CANVAS_HEIGHT / 2;

    const style = (size, col = '#ffffff') => ({
      fontSize: `${size}px`, fontFamily: 'Courier New', color: col,
    });

    this.add.text(cx, cy - 130, 'GAME OVER', style(54, '#ff2244'))
      .setOrigin(0.5)
      .setStroke('#440011', 2);

    this.add.text(cx, cy - 50,  `SCORE:   ${this._score}`,   style(24)).setOrigin(0.5);
    this.add.text(cx, cy - 10,  `LEVEL:   ${this._level}`,   style(18, '#aaaaaa')).setOrigin(0.5);
    this.add.text(cx, cy + 30,  `HI SCORE: ${this._hiScore}`, style(20, '#ffd700')).setOrigin(0.5);

    this.add.text(cx, cy + 110, 'PRESS ENTER OR CLICK TO PLAY AGAIN', style(18, '#00ffcc'))
      .setOrigin(0.5);

    this.add.text(cx, cy + 150, 'PRESS ESC TO RETURN TO LOBBY', style(14, '#445555'))
      .setOrigin(0.5);

    // Keyboard
    this.input.keyboard.once('keydown-ENTER', () => this._restart());
    this.input.keyboard.once('keydown-SPACE', () => this._restart());
    this.input.keyboard.once('keydown-ESC',   () => this.scene.start('Lobby'));
    this.input.once('pointerdown',            () => this._restart());
  }

  _restart() {
    this.scene.start('Game', { role: 'solo', nm: null });
  }
}
