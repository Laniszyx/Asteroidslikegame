import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR } from '../config.js';
import { NetworkManager, NET_ROLE } from '../network/NetworkManager.js';

/**
 * LobbyScene – pre-game room UI.
 *  • Solo play (immediate start)
 *  • Host a room (shows Peer ID for opponent to join)
 *  • Join a room (enter host's Peer ID)
 */
export default class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    const cx = CANVAS_WIDTH  / 2;
    const cy = CANVAS_HEIGHT / 2;

    this._nm = null;

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 80, 'NEON VECTOR', {
      fontSize: '52px', fontFamily: 'Courier New',
      color: '#00ffcc', stroke: '#006644', strokeThickness: 2,
    }).setOrigin(0.5);

    this.add.text(cx, 135, 'P2P SHOOTER', {
      fontSize: '22px', fontFamily: 'Courier New', color: '#448888',
    }).setOrigin(0.5);

    // ── Buttons ───────────────────────────────────────────────────────────
    this._soloBtn = this._makeBtn(cx, cy - 60, '▶  SOLO PLAY', () => this._startSolo());
    this._hostBtn = this._makeBtn(cx, cy,      '⊕  HOST ROOM', () => this._hostRoom());
    this._joinBtn = this._makeBtn(cx, cy + 60, '⊞  JOIN ROOM', () => this._showJoinUI());

    // ── Status text ───────────────────────────────────────────────────────
    this._status = this.add.text(cx, cy + 160, '', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#aaffaa',
    }).setOrigin(0.5);

    // ── Join input (hidden initially) ─────────────────────────────────────
    this._joinInput = null;
    this._joinGroup = null;

    // ── Controls hint ─────────────────────────────────────────────────────
    this.add.text(cx, CANVAS_HEIGHT - 40, 'A/D ROTATE    W THRUST    S REVERSE    SPACE FIRE    SHIFT SHIELD', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#334444',
    }).setOrigin(0.5);

    // Star field (cosmetic background)
    this._stars = this._makeStars(120);
  }

  update(time) {
    // Twinkle stars
    if (this._stars) {
      this._stars.forEach((s, i) => {
        s.setAlpha(0.3 + Math.sin(time * 0.001 + i) * 0.3);
      });
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  _startSolo() {
    this.scene.start('Game', { role: NET_ROLE.SOLO, nm: null });
  }

  _hostRoom() {
    this._disableButtons();
    this._setStatus('Connecting to signaling server…');

    const nm = new NetworkManager();
    nm.init(NET_ROLE.HOST, null, {
      onReady: (peerId) => {
        this._setStatus(`Your Room ID:\n${peerId}\n\nWaiting for opponent…`);
      },
      onClientJoin: () => {
        this._setStatus('Opponent connected!  Starting…');
        setTimeout(() => this.scene.start('Game', { role: NET_ROLE.HOST, nm }), 800);
      },
      onDisconnect: (reason) => {
        this._setStatus(`Disconnected: ${reason}`);
        nm.destroy();
        this._enableButtons();
      },
    });
    this._nm = nm;
  }

  _showJoinUI() {
    if (this._joinGroup) return;
    this._disableButtons();

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2 + 130;

    const label = this.add.text(cx, cy - 24, 'Enter Host Room ID:', {
      fontSize: '16px', fontFamily: 'Courier New', color: '#aaffaa',
    }).setOrigin(0.5);

    // HTML input element overlaid on canvas
    const el = document.createElement('input');
    el.type        = 'text';
    el.placeholder = 'paste room id here';
    el.style.cssText = [
      'position:fixed', 'font-family:Courier New', 'font-size:14px',
      'background:#001111', 'color:#00ffcc', 'border:1px solid #00ffcc',
      'padding:6px 10px', 'outline:none', 'width:280px', 'text-align:center',
    ].join(';');
    document.body.appendChild(el);

    // Position the input over the canvas
    const canvas = this.game.canvas;
    const rect   = canvas.getBoundingClientRect();
    el.style.left = `${rect.left + cx - 140}px`;
    el.style.top  = `${rect.top  + cy + 6}px`;
    el.focus();

    const connectBtn = this._makeBtn(cx, cy + 56, 'CONNECT', () => {
      const id = el.value.trim();
      if (!id) return;
      this._joinRoom(id);
      el.remove();
      label.destroy();
      connectBtn.destroy();
      this._joinGroup = null;
    });

    this._joinInput = el;
    this._joinGroup = { label, connectBtn, el };
  }

  _joinRoom(hostId) {
    this._setStatus(`Connecting to ${hostId}…`);

    const nm = new NetworkManager();
    nm.init(NET_ROLE.CLIENT, hostId, {
      onReady: () => {
        this._setStatus('Connected!  Starting…');
        setTimeout(() => this.scene.start('Game', { role: NET_ROLE.CLIENT, nm }), 600);
      },
      onDisconnect: (reason) => {
        this._setStatus(`Failed: ${reason}`);
        nm.destroy();
        this._enableButtons();
      },
    });
    this._nm = nm;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  _makeBtn(x, y, label, cb) {
    const t = this.add.text(x, y, label, {
      fontSize: '22px', fontFamily: 'Courier New',
      color: '#00ffcc', stroke: '#004433', strokeThickness: 1,
      padding: { x: 16, y: 8 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => t.setColor('#ffffff'))
      .on('pointerout',  () => t.setColor('#00ffcc'))
      .on('pointerdown', cb);
    return t;
  }

  _setStatus(msg) {
    if (this._status) this._status.setText(msg);
  }

  _disableButtons() {
    [this._soloBtn, this._hostBtn, this._joinBtn].forEach(b => {
      if (b) b.disableInteractive().setColor('#336655');
    });
  }

  _enableButtons() {
    [this._soloBtn, this._hostBtn, this._joinBtn].forEach(b => {
      if (b) b.setInteractive().setColor('#00ffcc');
    });
  }

  _makeStars(n) {
    return Array.from({ length: n }, () => {
      const x = Math.random() * CANVAS_WIDTH;
      const y = Math.random() * CANVAS_HEIGHT;
      return this.add.rectangle(x, y, 2, 2, 0xaaffff).setAlpha(0.4);
    });
  }

  shutdown() {
    if (this._joinInput) { this._joinInput.remove(); this._joinInput = null; }
  }
}
