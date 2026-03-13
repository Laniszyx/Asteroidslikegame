import Phaser from 'phaser';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  THRUST, MAX_SPEED, DRAG, ROTATE_SPEED, BULLET_SPEED,
  SHIELD_MAX_HP, SHIELD_REGEN,
  RUNTIME,
} from '../config.js';

// ─── Tab identifiers ────────────────────────────────────────────────────────
const TAB = { CONTROLS: 0, DEV: 1 };

// ─── Godmode constants ──────────────────────────────────────────────────────
const GODMODE_THRESHOLD = 9000;
const GODMODE_VALUE     = 99999;

// ─── Developer-adjustable stat definitions ──────────────────────────────────
const DEV_STATS = [
  { key: 'THRUST',        label: 'Thrust',        step: 30,   min: 60,   max: 1200, decimals: 0 },
  { key: 'MAX_SPEED',     label: 'Max Speed',      step: 30,   min: 60,   max: 1200, decimals: 0 },
  { key: 'DRAG',          label: 'Drag',           step: 0.01, min: 0.80, max: 1.00, decimals: 2 },
  { key: 'ROTATE_SPEED',  label: 'Rotate Speed',   step: 0.2,  min: 0.4,  max: 10,   decimals: 1 },
  { key: 'BULLET_SPEED',  label: 'Bullet Speed',   step: 50,   min: 100,  max: 2000, decimals: 0 },
  { key: 'SHIELD_MAX_HP', label: 'Shield Max HP',  step: 10,   min: 10,   max: 500,  decimals: 0 },
  { key: 'SHIELD_REGEN',  label: 'Shield Regen',   step: 5,    min: 0,    max: 100,  decimals: 0 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const FONT = 'Courier New';
const style = (size, color = '#00ffcc') => ({
  fontSize: `${size}px`, fontFamily: FONT, color,
});

export default class PauseMenuScene extends Phaser.Scene {
  constructor() { super('PauseMenu'); }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  create() {
    this._tab = TAB.CONTROLS;
    this._devRows = [];
    this._allObjects = [];   // track everything for cleanup

    // ── Overlay background ────────────────────────────────────────────────
    this._overlay = this.add.rectangle(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      CANVAS_WIDTH, CANVAS_HEIGHT,
      0x000000, 0.75,
    ).setDepth(0);

    // ── Title ─────────────────────────────────────────────────────────────
    this._title = this.add.text(CANVAS_WIDTH / 2, 40, '═══  PAUSED  ═══', style(28, '#00ffff'))
      .setOrigin(0.5).setDepth(1);

    // ── Resume hint ───────────────────────────────────────────────────────
    this._resumeHint = this.add.text(CANVAS_WIDTH / 2, 80, 'Press ESC to resume', style(14, '#888888'))
      .setOrigin(0.5).setDepth(1);

    // ── Tab buttons ───────────────────────────────────────────────────────
    const tabY = 115;
    this._tabControls = this._makeTab(CANVAS_WIDTH / 2 - 110, tabY, '[ CONTROLS ]', TAB.CONTROLS);
    this._tabDev      = this._makeTab(CANVAS_WIDTH / 2 + 110, tabY, '[ DEV TOOLS ]', TAB.DEV);

    // ── Content area ──────────────────────────────────────────────────────
    this._contentY = 150;
    this._showTab(TAB.CONTROLS);

    // ── ESC to resume ─────────────────────────────────────────────────────
    this._escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._escKey.on('down', () => this._resume());
  }

  // ─── Tab management ─────────────────────────────────────────────────────

  _makeTab(x, y, label, tabId) {
    const txt = this.add.text(x, y, label, style(14, tabId === this._tab ? '#00ffff' : '#556666'))
      .setOrigin(0.5).setDepth(1)
      .setInteractive({ useHandCursor: true });

    txt.on('pointerover', () => txt.setColor('#ffffff'));
    txt.on('pointerout',  () => txt.setColor(tabId === this._tab ? '#00ffff' : '#556666'));
    txt.on('pointerdown', () => this._showTab(tabId));

    this._allObjects.push(txt);
    return txt;
  }

  _showTab(tabId) {
    this._tab = tabId;

    // Update tab highlight colours
    this._tabControls?.setColor(tabId === TAB.CONTROLS ? '#00ffff' : '#556666');
    this._tabDev?.setColor(tabId === TAB.DEV ? '#00ffff' : '#556666');

    // Clear previous content
    this._clearContent();

    if (tabId === TAB.CONTROLS) this._buildControlsPanel();
    else                        this._buildDevPanel();
  }

  _clearContent() {
    for (const obj of this._contentObjects ?? []) obj.destroy();
    this._contentObjects = [];
    this._devRows = [];
  }

  // ─── Controls panel ─────────────────────────────────────────────────────

  _buildControlsPanel() {
    const cx = CANVAS_WIDTH / 2;
    let y = this._contentY + 15;

    const addLine = (text, color = '#88ddbb', size = 13) => {
      const t = this.add.text(cx, y, text, style(size, color)).setOrigin(0.5).setDepth(1);
      this._contentObjects.push(t);
      y += size + 8;
      return t;
    };

    addLine('─── MOVEMENT ───', '#00ffcc', 14);
    addLine('W  /  ↑          Thrust forward');
    addLine('S  /  ↓          Reverse thrust (60%)');
    addLine('A  /  ←          Turn left');
    addLine('D  /  →          Turn right');
    y += 8;
    addLine('─── COMBAT ───', '#00ffcc', 14);
    addLine('SPACE / L-CLICK  Fire weapon');
    addLine('SHIFT            Activate shield');
    y += 8;
    addLine('─── SYSTEM ───', '#00ffcc', 14);
    addLine('ESC              Pause / Menu');
    y += 16;
    addLine('─── POWERUPS ───', '#00ffcc', 14);
    addLine('◆ Shield Restore — refill shield', '#ffdd44', 11);
    addLine('◆ Rapid Fire — faster shots (8s)', '#ffdd44', 11);
    addLine('◆ Railgun — instant beam weapon', '#ffdd44', 11);
    addLine('◆ Black Hole — pulls enemies', '#ffdd44', 11);
    addLine('◆ Extra Life — +1 ship', '#ffdd44', 11);
    addLine('◆ Spread Shot — triple spread', '#ffdd44', 11);
    addLine('◆ Speed Boost — faster (6s)', '#ffdd44', 11);
  }

  // ─── Developer tools panel ──────────────────────────────────────────────

  _buildDevPanel() {
    const leftX = 160;
    let y = this._contentY + 10;

    // Section: RUNTIME config values
    const header1 = this.add.text(CANVAS_WIDTH / 2, y, '─── PHYSICS / WEAPONS ───', style(14, '#00ffcc'))
      .setOrigin(0.5).setDepth(1);
    this._contentObjects.push(header1);
    y += 28;

    for (const stat of DEV_STATS) {
      this._addDevRow(leftX, y, stat);
      y += 28;
    }

    // Section: Player instance values
    y += 8;
    const header2 = this.add.text(CANVAS_WIDTH / 2, y, '─── PLAYER ───', style(14, '#00ffcc'))
      .setOrigin(0.5).setDepth(1);
    this._contentObjects.push(header2);
    y += 28;

    // Lives
    this._addPlayerRow(leftX, y, 'Lives', 'lives', 1, 1, 99, 0);
    y += 28;

    // Shield HP
    this._addPlayerRow(leftX, y, 'Shield HP', 'shieldHP', 10, 0, 500, 0);
    y += 28;

    // Godmode toggle
    this._addGodmodeRow(leftX, y);
    y += 28;

    // Reset button
    y += 10;
    const resetBtn = this.add.text(CANVAS_WIDTH / 2, y, '[ RESET ALL TO DEFAULT ]', style(14, '#ff4444'))
      .setOrigin(0.5).setDepth(1)
      .setInteractive({ useHandCursor: true });
    resetBtn.on('pointerover', () => resetBtn.setColor('#ff8888'));
    resetBtn.on('pointerout',  () => resetBtn.setColor('#ff4444'));
    resetBtn.on('pointerdown', () => this._resetAll());
    this._contentObjects.push(resetBtn);
  }

  _addDevRow(leftX, y, stat) {
    const { key, label, step, min, max, decimals } = stat;
    const row = {};

    // Label
    row.label = this.add.text(leftX, y, label, style(13, '#88ddbb')).setOrigin(0, 0.5).setDepth(1);

    // Value display
    row.value = this.add.text(leftX + 260, y, this._fmtVal(RUNTIME[key], decimals), style(13, '#ffffff'))
      .setOrigin(0.5, 0.5).setDepth(1);

    // Minus button
    row.minus = this._makeButton(leftX + 320, y, ' − ', () => {
      RUNTIME[key] = Math.max(min, parseFloat((RUNTIME[key] - step).toFixed(decimals + 2)));
      row.value.setText(this._fmtVal(RUNTIME[key], decimals));
    });

    // Plus button
    row.plus = this._makeButton(leftX + 370, y, ' + ', () => {
      RUNTIME[key] = Math.min(max, parseFloat((RUNTIME[key] + step).toFixed(decimals + 2)));
      row.value.setText(this._fmtVal(RUNTIME[key], decimals));
    });

    this._contentObjects.push(row.label, row.value, row.minus, row.plus);
    this._devRows.push({ ...row, stat });
  }

  _addPlayerRow(leftX, y, label, prop, step, min, max, decimals) {
    const row = {};

    row.label = this.add.text(leftX, y, label, style(13, '#88ddbb')).setOrigin(0, 0.5).setDepth(1);

    const player = this._getPlayer();
    const initVal = player ? player[prop] : 0;

    row.value = this.add.text(leftX + 260, y, this._fmtVal(initVal, decimals), style(13, '#ffffff'))
      .setOrigin(0.5, 0.5).setDepth(1);

    row.minus = this._makeButton(leftX + 320, y, ' − ', () => {
      const p = this._getPlayer();
      if (!p) return;
      p[prop] = Math.max(min, parseFloat((p[prop] - step).toFixed(decimals + 2)));
      row.value.setText(this._fmtVal(p[prop], decimals));
    });

    row.plus = this._makeButton(leftX + 370, y, ' + ', () => {
      const p = this._getPlayer();
      if (!p) return;
      p[prop] = Math.min(max, parseFloat((p[prop] + step).toFixed(decimals + 2)));
      row.value.setText(this._fmtVal(p[prop], decimals));
    });

    this._contentObjects.push(row.label, row.value, row.minus, row.plus);
    this._devRows.push({ ...row, prop });
  }

  _addGodmodeRow(leftX, y) {
    const row = {};

    row.label = this.add.text(leftX, y, 'Godmode', style(13, '#88ddbb')).setOrigin(0, 0.5).setDepth(1);

    const player = this._getPlayer();
    const isGod = player && player.invincible > GODMODE_THRESHOLD;

    row.value = this.add.text(leftX + 260, y, isGod ? 'ON' : 'OFF', style(13, isGod ? '#00ff88' : '#ff4444'))
      .setOrigin(0.5, 0.5).setDepth(1);

    row.toggle = this._makeButton(leftX + 345, y, ' TOGGLE ', () => {
      const p = this._getPlayer();
      if (!p) return;
      if (p.invincible > GODMODE_THRESHOLD) {
        p.invincible = 0;
        row.value.setText('OFF').setColor('#ff4444');
      } else {
        p.invincible = GODMODE_VALUE;
        row.value.setText('ON').setColor('#00ff88');
      }
    });

    this._contentObjects.push(row.label, row.value, row.toggle);
  }

  // ─── UI helpers ─────────────────────────────────────────────────────────

  _makeButton(x, y, label, callback) {
    const btn = this.add.text(x, y, label, style(13, '#00ffcc'))
      .setOrigin(0.5, 0.5).setDepth(1)
      .setBackgroundColor('#112222')
      .setPadding(4, 2)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#ffffff').setBackgroundColor('#224444'));
    btn.on('pointerout',  () => btn.setColor('#00ffcc').setBackgroundColor('#112222'));
    btn.on('pointerdown', () => callback());

    return btn;
  }

  _fmtVal(val, decimals) {
    return Number(val).toFixed(decimals);
  }

  _getPlayer() {
    const game = this.scene.get('Game');
    return game?._player ?? null;
  }

  // ─── Reset all values to defaults ───────────────────────────────────────

  _resetAll() {
    RUNTIME.THRUST        = THRUST;
    RUNTIME.MAX_SPEED     = MAX_SPEED;
    RUNTIME.DRAG          = DRAG;
    RUNTIME.ROTATE_SPEED  = ROTATE_SPEED;
    RUNTIME.BULLET_SPEED  = BULLET_SPEED;
    RUNTIME.SHIELD_MAX_HP = SHIELD_MAX_HP;
    RUNTIME.SHIELD_REGEN  = SHIELD_REGEN;

    // Refresh the panel
    this._showTab(TAB.DEV);
  }

  // ─── Resume game ────────────────────────────────────────────────────────

  _resume() {
    const game = this.scene.get('Game');
    if (game) game._paused = false;
    this.scene.stop('PauseMenu');
  }

  shutdown() {
    this._clearContent();
    for (const obj of this._allObjects) {
      if (obj && obj.destroy) obj.destroy();
    }
    this._allObjects = [];
  }
}
