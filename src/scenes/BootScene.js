import Phaser from 'phaser';

/**
 * BootScene – minimal preload + transition to lobby.
 * (No assets to load; all visuals are procedural.)
 */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // Nothing to preload. Go straight to the lobby.
    this.scene.start('Lobby');
  }
}
