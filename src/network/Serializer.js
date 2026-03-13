/**
 * Binary serializer / deserializer for game state packets.
 *
 * Packet layout:
 *
 *  HEADER (4 bytes)
 *    [0]  MSG_TYPE  : UInt8
 *    [1]  SEQ       : UInt8   (wrapping sequence number)
 *    [2-3] TICK     : UInt16  (host simulation tick)
 *
 *  Then depending on MSG_TYPE:
 *
 *  MSG_STATE (0x01) – full snapshot
 *    N_ENTITIES : UInt8
 *    per entity (21 bytes each):
 *      id      : UInt8
 *      type    : UInt8   (0=ship,1=asteroid,2=bullet,3=ufo,4=hole)
 *      x       : Float32
 *      y       : Float32
 *      vx      : Float32
 *      vy      : Float32
 *      angle   : Int16   (radians × 1000)
 *      flags   : UInt8   (alive, shield, etc.)
 *
 *  MSG_INPUT (0x02)
 *    tick    : UInt16
 *    input   : UInt8    (bitmask)
 *
 *  MSG_EVENT (0x03) – scored event / special
 *    eventId : UInt8
 *    data    : UInt32
 */

export const MSG = {
  STATE: 0x01,
  INPUT: 0x02,
  EVENT: 0x03,
  PING:  0x04,
  PONG:  0x05,
};

export const ENTITY_TYPE = {
  SHIP:      0,
  ASTEROID:  1,
  BULLET:    2,
  UFO:       3,
  BLACK_HOLE: 4,
  POWERUP:   5,
  BARRIER:   6,
};

// ─── Encode ──────────────────────────────────────────────────────────────────

/**
 * Encode a state snapshot to an ArrayBuffer.
 * @param {number}  seq
 * @param {number}  tick
 * @param {Array}   entities  array of entity descriptors
 * @returns {ArrayBuffer}
 */
export function encodeState(seq, tick, entities) {
  const count  = entities.length;
  // Header: 4 bytes + count byte (1) + 21 bytes per entity
  const buffer = new ArrayBuffer(5 + count * 21);
  const view   = new DataView(buffer);

  view.setUint8(0,  MSG.STATE);
  view.setUint8(1,  seq & 0xff);
  view.setUint16(2, tick & 0xffff, true);
  view.setUint8(4,  count);

  let off = 5;
  for (const e of entities) {
    view.setUint8(off,      e.id   & 0xff);                              // 1
    view.setUint8(off + 1,  e.type & 0xff);                              // 1
    view.setFloat32(off + 2,  e.x,  true);                               // 4
    view.setFloat32(off + 6,  e.y,  true);                               // 4
    view.setFloat32(off + 10, e.vx, true);                               // 4
    view.setFloat32(off + 14, e.vy, true);                               // 4
    view.setInt16(off + 18, Math.round(e.angle * 1000) & 0xffff, true);  // 2
    view.setUint8(off + 20, e.flags & 0xff);                             // 1  → total 21
    off += 21;
  }

  return buffer;
}

/**
 * Decode a state snapshot ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {{ seq:number, tick:number, entities:Array }}
 */
export function decodeState(buffer) {
  const view     = new DataView(buffer);
  const seq      = view.getUint8(1);
  const tick     = view.getUint16(2, true);
  const count    = view.getUint8(4);
  const entities = [];

  let off = 5;
  for (let i = 0; i < count; i++) {
    entities.push({
      id:    view.getUint8(off),
      type:  view.getUint8(off + 1),
      x:     view.getFloat32(off + 2,  true),
      y:     view.getFloat32(off + 6,  true),
      vx:    view.getFloat32(off + 10, true),
      vy:    view.getFloat32(off + 14, true),
      angle: view.getInt16(off + 18, true) / 1000,
      flags: view.getUint8(off + 20),
    });
    off += 21;
  }

  return { seq, tick, entities };
}

/**
 * Encode an input message.
 * @param {number} seq
 * @param {number} tick
 * @param {number} inputMask
 * @returns {ArrayBuffer}
 */
export function encodeInput(seq, tick, inputMask) {
  const buffer = new ArrayBuffer(6);
  const view   = new DataView(buffer);
  view.setUint8(0,  MSG.INPUT);
  view.setUint8(1,  seq & 0xff);
  view.setUint16(2, tick & 0xffff, true);
  view.setUint8(4,  inputMask & 0xff);
  return buffer;
}

/**
 * Decode an input message.
 * @param {ArrayBuffer} buffer
 * @returns {{ seq:number, tick:number, input:number }}
 */
export function decodeInput(buffer) {
  const view = new DataView(buffer);
  return {
    seq:   view.getUint8(1),
    tick:  view.getUint16(2, true),
    input: view.getUint8(4),
  };
}

/**
 * Encode a game event (score, powerup, etc.).
 * @param {number} seq
 * @param {number} tick
 * @param {number} eventId
 * @param {number} data
 * @returns {ArrayBuffer}
 */
export function encodeEvent(seq, tick, eventId, data) {
  const buffer = new ArrayBuffer(9);
  const view   = new DataView(buffer);
  view.setUint8(0,  MSG.EVENT);
  view.setUint8(1,  seq & 0xff);
  view.setUint16(2, tick & 0xffff, true);
  view.setUint8(4,  eventId & 0xff);
  view.setUint32(5, data >>> 0, true);
  return buffer;
}

export function decodeEvent(buffer) {
  const view = new DataView(buffer);
  return {
    seq:     view.getUint8(1),
    tick:    view.getUint16(2, true),
    eventId: view.getUint8(4),
    data:    view.getUint32(5, true),
  };
}

/** Determine the message type of a received ArrayBuffer. */
export function getMsgType(buffer) {
  return new DataView(buffer).getUint8(0);
}
