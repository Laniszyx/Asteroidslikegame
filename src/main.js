import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import BootScene      from './scenes/BootScene.js';
import LobbyScene     from './scenes/LobbyScene.js';
import GameScene      from './scenes/GameScene.js';
import GameOverScene  from './scenes/GameOverScene.js';
import PauseMenuScene from './scenes/PauseMenuScene.js';
import { GlowFXPipeline } from './rendering/GlowFXPipeline.js';

const config = {
  type: Phaser.WEBGL,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#050510',
  pipeline: { GlowFXPipeline },
  scene: [BootScene, LobbyScene, GameScene, GameOverScene, PauseMenuScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { y: 0 } },
  },
};

const game = new Phaser.Game(config);
// Expose for external access
if (typeof window !== 'undefined') window.__GAME__ = game;
