// ─── Game-wide constants ────────────────────────────────────────────────────

export const CANVAS_WIDTH  = 960;
export const CANVAS_HEIGHT = 720;

// World size (larger than the viewport – camera follows the player)
export const WORLD_WIDTH   = 7680;
export const WORLD_HEIGHT  = 5760;

// Physics
export const DRAG          = 0.96;       // per-frame velocity damping (lower = less inertia)
export const THRUST        = 360;        // pixels/s²
export const ROTATE_SPEED  = 3.2;        // radians/s
export const MAX_SPEED     = 420;        // pixels/s
export const BULLET_SPEED  = 600;        // pixels/s
export const BULLET_TTL    = 1.8;        // seconds
export const SHIP_RADIUS   = 14;

// Asteroid sizes  [radius, score, splits-into]
export const ASTEROID_DEFS = {
  large:  { radius: 52, score: 20,  splits: 'medium', count: 2 },
  medium: { radius: 26, score: 50,  splits: 'small',  count: 2 },
  small:  { radius: 13, score: 100, splits: null,     count: 0 },
};

// Input bitmask
export const INPUT = {
  THRUST:       0b0000001,
  ROTATE_LEFT:  0b0000010,
  ROTATE_RIGHT: 0b0000100,
  FIRE:         0b0001000,
  SHIELD:       0b0010000,
  HYPERSPACE:   0b0100000,
  REVERSE:      0b1000000,
};

// Networking
export const TICK_RATE          = 20;        // Hz (50 ms)
export const SNAPSHOT_DELAY_MS  = 100;
export const HISTORY_BUFFER_MS  = 500;
export const RECONNECT_TIMEOUT  = 8000;

// Weapons
export const FIRE_RATE          = 0.18;      // seconds between shots
export const RAILGUN_COOLDOWN   = 3.0;
export const SHIELD_MAX_HP      = 100;
export const SHIELD_REGEN       = 15;        // /s

// UFO
export const UFO_SPAWN_INTERVAL = 25;        // seconds
export const UFO_SPEED          = 140;
export const UFO_FIRE_RATE      = 1.5;

// Colours
export const COLOR = {
  SHIP:       0x00ffff,
  BULLET:     0xffffff,
  ASTEROID:   0xff8800,
  UFO:        0xff00ff,
  BLACK_HOLE: 0x8800ff,
  SHIELD:     0x0088ff,
  RAILGUN:    0xffff00,
  HUD:        0x00ffcc,
  DANGER:     0xff2244,
};

// Levels
export const LEVEL_BASE_ASTEROIDS = 4;       // + (level-1)*2

// DDA
export const DDA_DROP_TABLE = [
  { type: 'shield_restore', weight: 3 },
  { type: 'rapid_fire',     weight: 2 },
  { type: 'railgun',        weight: 1 },
  { type: 'black_hole',     weight: 1 },
];
