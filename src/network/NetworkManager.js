import { Peer } from 'peerjs';
import {
  getMsgType, MSG,
  encodeState, decodeState,
  encodeInput, decodeInput,
  encodeEvent, decodeEvent,
} from './Serializer.js';
import { SnapshotBuffer } from './SnapshotBuffer.js';
import { TICK_RATE, RECONNECT_TIMEOUT } from '../config.js';

// PeerJS public cloud broker (free tier, no server required)
const PEER_CONFIG = {
  debug: 0,
};

export const NET_ROLE = { SOLO: 'solo', HOST: 'host', CLIENT: 'client' };

/**
 * NetworkManager – handles PeerJS signaling, DataChannel messaging,
 * snapshot buffering and input history for lag-compensated hit detection.
 *
 * Usage (Host):
 *   nm.init(NET_ROLE.HOST, null, callbacks)
 *   nm.broadcastState(tick, entities)
 *
 * Usage (Client):
 *   nm.init(NET_ROLE.CLIENT, hostPeerId, callbacks)
 *   nm.sendInput(tick, inputMask)
 *   nm.getInterpolated()   → Map<id, entityState>
 */
export class NetworkManager {
  constructor() {
    this.role    = NET_ROLE.SOLO;
    this.peer    = null;
    this.conn    = null;           // DataConnection to host (client-side)
    this.clients = new Map();      // peerId → DataConnection (host-side)
    this.peerId  = null;
    this._seq    = 0;
    this._tick   = 0;

    this.snapshots = new SnapshotBuffer(600);

    /** Input history ring: { tick, input, time }[] for lag-compensation */
    this._inputHistory = [];

    /** Pending unacknowledged inputs for client-side prediction */
    this._pendingInputs = [];

    this._callbacks = {};
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * @param {string}  role          NET_ROLE.*
   * @param {string|null} hostId    host peer-id when CLIENT
   * @param {object}  callbacks     { onReady, onClientJoin, onState, onInput, onEvent, onDisconnect }
   */
  init(role, hostId, callbacks) {
    this.role        = role;
    this._callbacks  = callbacks || {};

    if (role === NET_ROLE.SOLO) {
      this._callbacks.onReady?.('solo');
      return;
    }

    this.peer = new Peer(undefined, PEER_CONFIG);

    this.peer.on('open', (id) => {
      this.peerId = id;
      if (role === NET_ROLE.HOST) {
        this._setupHostListeners();
        this._callbacks.onReady?.(id);
      } else {
        this._connectToHost(hostId);
      }
    });

    this.peer.on('error', (err) => {
      console.error('[Net] PeerJS error:', err);
      this._callbacks.onDisconnect?.('error: ' + err.type);
    });
  }

  /** HOST: broadcast current world state to all connected clients. */
  broadcastState(tick, entities) {
    if (this.clients.size === 0) return;
    this._tick = tick;
    const buf  = encodeState(this._nextSeq(), tick, entities);
    for (const conn of this.clients.values()) {
      if (conn.open) conn.send(buf);
    }
  }

  /** CLIENT: send local input to host. */
  sendInput(tick, inputMask) {
    if (!this.conn || !this.conn.open) return;
    const buf = encodeInput(this._nextSeq(), tick, inputMask);
    this.conn.send(buf);

    // Store for client-side prediction reconciliation
    this._pendingInputs.push({ tick, input: inputMask });
    if (this._pendingInputs.length > 120) this._pendingInputs.shift();
  }

  /** HOST: send a game event to all clients. */
  broadcastEvent(tick, eventId, data) {
    const buf = encodeEvent(this._nextSeq(), tick, eventId, data);
    for (const conn of this.clients.values()) {
      if (conn.open) conn.send(buf);
    }
  }

  /** CLIENT: get interpolated snapshot for rendering. */
  getInterpolated() {
    return this.snapshots.getInterpolated();
  }

  /**
   * HOST: rewind entity positions to `clientShootTime` for precise hit detection.
   * @param {number} clientShootTime  performance.now()-based timestamp
   */
  rewindTo(clientShootTime) {
    return this.snapshots.rewindTo(clientShootTime);
  }

  /** Drain and return all queued inputs received by the host this frame. */
  drainInputs() {
    const inputs = this._pendingFromClients || [];
    this._pendingFromClients = [];
    return inputs;
  }

  /** Is a client connected? */
  get hasClient() { return this.clients.size > 0; }

  destroy() {
    if (this.peer) { this.peer.destroy(); this.peer = null; }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _nextSeq() { return (this._seq = (this._seq + 1) & 0xff); }

  _setupHostListeners() {
    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.clients.set(conn.peer, conn);
        this._callbacks.onClientJoin?.(conn.peer);
        this._setupDataChannel(conn);
      });
      conn.on('close',  () => this._handleClientDisconnect(conn.peer));
      conn.on('error', () => this._handleClientDisconnect(conn.peer));
    });
  }

  _connectToHost(hostId) {
    const conn = this.peer.connect(hostId, {
      reliable:    false,
      serialization: 'binary',
    });

    const timeout = setTimeout(() => {
      this._callbacks.onDisconnect?.('timeout');
    }, RECONNECT_TIMEOUT);

    conn.on('open', () => {
      clearTimeout(timeout);
      this.conn = conn;
      this._setupDataChannel(conn);
      this._callbacks.onReady?.(this.peerId);
    });

    conn.on('close', ()  => this._callbacks.onDisconnect?.('closed'));
    conn.on('error', (e) => this._callbacks.onDisconnect?.('error: ' + e));
  }

  _setupDataChannel(conn) {
    conn.on('data', (raw) => {
      // PeerJS delivers binary data as ArrayBuffer
      const buf  = raw instanceof ArrayBuffer ? raw : raw.buffer || raw;
      const type = getMsgType(buf);

      switch (type) {
        case MSG.STATE: {
          const snap = decodeState(buf);
          this.snapshots.push(snap.tick, snap.entities);
          this._callbacks.onState?.(snap);
          break;
        }
        case MSG.INPUT: {
          const inp = decodeInput(buf);
          if (!this._pendingFromClients) this._pendingFromClients = [];
          this._pendingFromClients.push({ peerId: conn.peer, ...inp });
          this._callbacks.onInput?.(inp, conn.peer);
          break;
        }
        case MSG.EVENT: {
          const ev = decodeEvent(buf);
          this._callbacks.onEvent?.(ev);
          break;
        }
      }
    });
  }

  _handleClientDisconnect(peerId) {
    this.clients.delete(peerId);
    this._callbacks.onDisconnect?.(peerId);
  }
}
