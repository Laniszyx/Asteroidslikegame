import Phaser from 'phaser';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, COLOR,
  TICK_RATE,
  LEVEL_BASE_ASTEROIDS,
  UFO_SPAWN_INTERVAL,
  INPUT,
} from '../config.js';

import { NET_ROLE }        from '../network/NetworkManager.js';
import { ENTITY_TYPE }     from '../network/Serializer.js';
import { NeonRenderer }    from '../rendering/NeonRenderer.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { InputSystem }     from '../systems/InputSystem.js';
import { ObjectPool }      from '../systems/PoolSystem.js';
import { WEAPON_TYPE as WT } from '../systems/WeaponFSM.js';

import { Ship }            from '../entities/Ship.js';
import { Asteroid, spawnWave } from '../entities/Asteroid.js';
import { Bullet }          from '../entities/Bullet.js';
import { UFO }             from '../entities/UFO.js';
import { BlackHole }       from '../entities/BlackHole.js';
import { Powerup, ddaDrop } from '../entities/Powerup.js';

// ─── Event IDs ──────────────────────────────────────────────────────────────
const EVT = {
  SCORE:    0x01,
  LIVES:    0x02,
  LEVEL:    0x03,
  POWERUP:  0x04,
  GAME_OVER:0x05,
};

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  // ─── Phaser lifecycle ───────────────────────────────────────────────────

  init(data) {
    this._role = data.role  ?? NET_ROLE.SOLO;
    this._nm   = data.nm   ?? null;
    this._isHost   = this._role !== NET_ROLE.CLIENT;
    this._isClient = this._role === NET_ROLE.CLIENT;
  }

  create() {
    // ── Rendering ──────────────────────────────────────────────────────────
    this._nr = new NeonRenderer(this);

    // ── Pipeline ──────────────────────────────────────────────────────────
    this._glowPipeline = this.renderer?.pipelines?.get?.('GlowFXPipeline') ?? null;

    // ── Input ──────────────────────────────────────────────────────────────
    this._input = new InputSystem(this);

    // ── Collision ──────────────────────────────────────────────────────────
    this._cs = new CollisionSystem();

    // ── Object Pools ──────────────────────────────────────────────────────
    this._bulletPool = new ObjectPool(
      () => new Bullet(),
      (b) => { b.alive = false; },
      64,
    );

    // ── Game State ─────────────────────────────────────────────────────────
    this._score    = 0;
    this._level    = 1;
    this._hiScore  = parseInt(localStorage.getItem('nv_hi') || '0', 10);

    // ── Entities ───────────────────────────────────────────────────────────
    this._player  = new Ship(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this._remote  = null;   // opponent ship (P2P)
    if (this._role === NET_ROLE.HOST && this._nm?.hasClient) {
      this._remote = new Ship(WORLD_WIDTH / 4, WORLD_HEIGHT / 4, 0, false);
    }

    this._asteroids = spawnWave(
      LEVEL_BASE_ASTEROIDS + (this._level - 1) * 2,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2,
      180,  // safe radius – give player room at spawn
    );
    this._bullets   = [];   // active Bullet instances from pool
    this._ufos      = [];
    this._holes     = [];
    this._powerups  = [];

    // ── Timers ─────────────────────────────────────────────────────────────
    this._ufoTimer      = UFO_SPAWN_INTERVAL;
    this._levelClear    = false;
    this._levelDelay    = 0;
    this._respawnTimer  = 0;
    this._tickTimer     = 0;
    this._tick          = 0;

    // ── Camera ─────────────────────────────────────────────────────────────
    // Set the world bounds for the larger world
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // We need a dummy follow target that we can update each frame with
    // the player's position, because Phaser camera follows game objects
    // not plain objects. We use a tiny invisible rectangle.
    this._camTarget = this.add.rectangle(
      this._player.x, this._player.y, 1, 1, 0x000000, 0
    ).setDepth(-10);
    this.cameras.main.startFollow(this._camTarget, true, 0.1, 0.1);

    // ── HUD ────────────────────────────────────────────────────────────────
    this._buildHUD();

    // ── Minimap ────────────────────────────────────────────────────────────
    this._buildMinimap();

    // ── Networking callbacks ───────────────────────────────────────────────
    if (this._nm) this._setupNetCallbacks();

    // ── Pause on blur ──────────────────────────────────────────────────────
    this.game.events.on('blur',  () => this._paused = true);
    this.game.events.on('focus', () => this._paused = false);
    this._paused = false;
  }

  update(time, delta) {
    if (this._paused) return;
    const dt = Math.min(delta / 1000, 0.05);  // cap at 50 ms to avoid spiral

    // Glow pipeline tick
    if (this._glowPipeline) this._glowPipeline.tick(delta);

    // ── CLIENT: render interpolated host state ─────────────────────────────
    if (this._isClient && this._nm) {
      this._renderClientInterpolated();
      // Send local input
      this._tickTimer += dt;
      if (this._tickTimer >= 1 / TICK_RATE) {
        this._tickTimer = 0;
        this._tick++;
        const mask = this._input.sample();
        this._nm.sendInput(this._tick, mask);
      }
      this._updateHUD();
      return;
    }

    // ── HOST / SOLO: full simulation ──────────────────────────────────────
    this._simulate(dt);

    // Update camera follow target to player position
    if (this._camTarget && this._player) {
      this._camTarget.setPosition(this._player.x, this._player.y);
    }

    // Broadcast state
    if (this._nm && this._role === NET_ROLE.HOST) {
      this._tickTimer += dt;
      if (this._tickTimer >= 1 / TICK_RATE) {
        this._tickTimer = 0;
        this._tick++;
        this._nm.broadcastState(this._tick, this._gatherNetEntities());
      }
    }

    // Draw everything
    this._drawFrame();
    this._updateHUD();
    this._drawMinimap();
  }

  // ─── Simulation ─────────────────────────────────────────────────────────

  _simulate(dt) {
    // Local player input
    let playerMask = this._input.sample();

    // Apply remote client inputs (host ingests them each tick)
    if (this._role === NET_ROLE.HOST && this._nm) {
      const inputs = this._nm.drainInputs();
      for (const inp of inputs) {
        // apply to remote ship (first client)
        if (this._remote) this._remote.update(dt, inp.input, (s) => this._spawnBullet(s));
      }
    }

    // Player ship
    if (this._player.alive) {
      // Compute aim angle from mouse cursor position
      this._player.aimAngle = this._input.getAimAngle(this._player.x, this._player.y);
      this._player.update(dt, playerMask, (s) => this._spawnBullet(s));
    } else if (this._respawnTimer > 0) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this._respawn();
    }

    // Asteroids
    for (const a of this._asteroids) a.update(dt);

    // Bullets
    for (const b of this._bullets) {
      b.update(dt);
      if (!b.alive) this._bulletPool.release(b);
    }
    this._bullets = this._bullets.filter(b => b.alive);

    // UFOs
    this._ufoTimer -= dt;
    if (this._ufoTimer <= 0 && this._level >= 2) {
      this._spawnUFO();
      this._ufoTimer = UFO_SPAWN_INTERVAL;
    }
    const aliveAsteroids = this._asteroids.filter(a => a.alive);
    for (const u of this._ufos) {
      u.update(dt, this._player, aliveAsteroids, (u) => this._spawnBullet(u));
    }

    // Black holes
    for (const h of this._holes) {
      h.update(dt);
      if (h.alive) {
        // Attract bullets, asteroids, ufos (not player)
        for (const b of this._bullets)   h.attract(b, dt);
        for (const a of this._asteroids) h.attract(a, dt);
        for (const u of this._ufos)      h.attract(u, dt);
      }
    }
    this._holes = this._holes.filter(h => h.alive);

    // Powerups
    for (const p of this._powerups) p.update(dt);
    this._powerups = this._powerups.filter(p => p.alive);

    // ── Collisions ──────────────────────────────────────────────────────────
    this._handleCollisions();

    // ── Level clear ─────────────────────────────────────────────────────────
    if (this._asteroids.every(a => !a.alive) && this._ufos.every(u => !u.alive)) {
      if (!this._levelClear) {
        this._levelClear = true;
        this._levelDelay = 2.5;
      }
    }

    if (this._levelClear) {
      this._levelDelay -= dt;
      if (this._levelDelay <= 0) this._nextLevel();
    }
  }

  // ─── Collisions ─────────────────────────────────────────────────────────

  _handleCollisions() {
    const liveAsteroids = this._asteroids.filter(a => a.alive);
    const liveUfos      = this._ufos.filter(u => u.alive);
    const ships         = [this._player, this._remote].filter(Boolean).filter(s => s.alive && s.invincible <= 0);

    // Build tree once
    const allEntities = [...liveAsteroids, ...liveUfos, ...this._bullets, ...ships, ...this._powerups];
    this._cs.build(allEntities);

    // Bullets vs Asteroids
    const bva = this._cs.query(this._bullets, liveAsteroids);
    for (const [b, a] of bva) {
      if (!b.alive || !a.alive) continue;
      b.alive = false;
      this._bulletPool.release(b);
      this._addScore(a.score);
      const frags = a.split();
      this._asteroids.push(...frags);
      this._tryDropPowerup(a.x, a.y);
    }

    // Bullets vs UFOs
    const bvu = this._cs.query(this._bullets, liveUfos);
    for (const [b, u] of bvu) {
      if (!b.alive || !u.alive) continue;
      b.alive = false;
      this._bulletPool.release(b);
      u.alive = false;
      this._addScore(u.score);
    }

    // Ships vs Asteroids
    const sva = this._cs.query(ships, liveAsteroids);
    for (const [s, a] of sva) {
      if (!s.alive || !a.alive) continue;
      if (s.shieldOn) {
        // Reflect asteroid
        const nx = s.x - a.x, ny = s.y - a.y;
        const len = Math.hypot(nx, ny) || 1;
        a.body.vx = (nx / len) * 180;
        a.body.vy = (ny / len) * 180;
        continue;
      }
      this._killShip(s);
      const frags = a.split();
      this._asteroids.push(...frags);
    }

    // Ships vs UFOs
    const svu = this._cs.query(ships, liveUfos);
    for (const [s, u] of svu) {
      if (!s.alive || !u.alive) continue;
      if (!s.shieldOn) this._killShip(s);
      u.alive = false;
    }

    // Ships vs Powerups
    const svp = this._cs.query(ships, this._powerups.filter(p => p.alive));
    for (const [s, p] of svp) {
      if (!p.alive) continue;
      p.alive = false;
      this._applyPowerup(s, p.type);
    }
  }

  // ─── Bullets ─────────────────────────────────────────────────────────────

  _spawnBullet(shooter) {
    const angle  = shooter.aimAngle ?? (shooter.body ? shooter.body.angle : shooter.angle);
    const x      = shooter.x + Math.sin(angle) * 18;
    const y      = shooter.y - Math.cos(angle) * 18;
    const isRail = shooter.weapon?.type === WT.RAILGUN;

    if (isRail) {
      // Railgun: instant raycast line, no bullet object needed for hit detection
      this._doRailgunShot(shooter, angle);
      return;
    }

    const spread = shooter.weapon?.type === WT.SPREAD ? 3 : 1;
    for (let i = 0; i < spread; i++) {
      const spread_angle = angle + (i - Math.floor(spread / 2)) * 0.12;
      const b = this._bulletPool.acquire();
      b.activate(x, y, spread_angle, shooter, false);
      this._bullets.push(b);
    }
  }

  /** Instant raycasting shot: sweep all asteroids & UFOs along the ray. */
  _doRailgunShot(shooter, angle) {
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const ox = shooter.x, oy = shooter.y;

    let endX = ox + dx * WORLD_WIDTH * 2;
    let endY = oy + dy * WORLD_WIDTH * 2;

    const targets = [
      ...this._asteroids.filter(a => a.alive),
      ...this._ufos.filter(u => u.alive),
    ];

    for (const t of targets) {
      // Ray-circle intersection
      const tcx = t.x - ox, tcy = t.y - oy;
      const proj = tcx * dx + tcy * dy;
      if (proj < 0) continue;
      const perp = Math.hypot(tcx - dx * proj, tcy - dy * proj);
      if (perp < t.radius) {
        if (t.split) {
          this._addScore(t.score);
          const frags = t.split();
          this._asteroids.push(...frags);
        } else {
          t.alive = false;
          this._addScore(t.score);
        }
        endX = ox + dx * (proj + t.radius);
        endY = oy + dy * (proj + t.radius);
        break;
      }
    }

    shooter.railgunBeam  = { ex: endX, ey: endY };
    shooter.railgunTimer = 0.18;
  }

  // ─── UFO ─────────────────────────────────────────────────────────────────

  _spawnUFO() {
    const variant = this._level >= 5 && Math.random() < 0.4 ? 'small' : 'large';
    const edge    = Math.random() < 0.5 ? 0 : WORLD_WIDTH;
    const y       = Math.random() * WORLD_HEIGHT;
    this._ufos.push(new UFO(variant, edge, y));
  }

  // ─── Ships ───────────────────────────────────────────────────────────────

  _killShip(ship) {
    if (!ship.alive) return;
    ship.alive = false;
    if (ship === this._player) {
      ship.lives--;
      this._updateHUD();
      if (ship.lives <= 0) {
        this._gameOver();
      } else {
        this._respawnTimer = 3;
      }
    }
  }

  _respawn() {
    this._player.respawn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  }

  // ─── Powerups ────────────────────────────────────────────────────────────

  _tryDropPowerup(x, y) {
    if (Math.random() > 0.18) return;
    const type = ddaDrop(this._player, this._asteroids.filter(a => a.alive).length);
    this._powerups.push(new Powerup(type, x, y));
  }

  _applyPowerup(ship, type) {
    switch (type) {
      case 'shield_restore':
        ship.shieldHP = 100;
        break;
      case 'rapid_fire':
        ship.rapidFire = 8;
        ship.weapon.setType(WT.LASER);
        break;
      case 'railgun':
        ship.weapon.setType(WT.RAILGUN);
        break;
      case 'black_hole': {
        const h = new BlackHole(ship.x, ship.y);
        this._holes.push(h);
        break;
      }
    }
    this._showPowerupText(type);
  }

  // ─── Scoring & Levels ────────────────────────────────────────────────────

  _addScore(pts) {
    this._score += pts;
    if (this._score > this._hiScore) {
      this._hiScore = this._score;
      localStorage.setItem('nv_hi', String(this._hiScore));
    }
    this._updateHUD();
  }

  _nextLevel() {
    this._level++;
    this._levelClear = false;
    this._levelDelay = 0;
    this._ufos       = [];
    this._bullets.forEach(b => this._bulletPool.release(b));
    this._bullets = [];
    this._holes   = [];
    this._asteroids = spawnWave(
      LEVEL_BASE_ASTEROIDS + (this._level - 1) * 2,
      WORLD_WIDTH / 2, WORLD_HEIGHT / 2,
      180,
    );
    this._ufoTimer = UFO_SPAWN_INTERVAL;
    this._updateHUD();
    this._showCenterText(`LEVEL ${this._level}`, 1800);
  }

  _gameOver() {
    this.time.delayedCall(1500, () => {
      this.scene.start('GameOver', {
        score:   this._score,
        hiScore: this._hiScore,
        level:   this._level,
      });
    });
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────

  _drawFrame() {
    this._nr.clear();

    // Starfield (static; drawn once in _buildHUD)
    for (const a of this._asteroids) a.draw(this._nr);
    for (const u of this._ufos)      u.draw(this._nr);
    for (const b of this._bullets)   b.draw(this._nr);
    for (const h of this._holes)     h.draw(this._nr);
    for (const p of this._powerups)  p.draw(this._nr);

    this._player.draw(this._nr);
    if (this._remote) this._remote.draw(this._nr);
  }

  /** CLIENT-SIDE: render from snapshot interpolation. */
  _renderClientInterpolated() {
    if (!this._nm) return;
    this._nr.clear();

    const states = this._nm.getInterpolated();
    for (const [, state] of states) {
      this._drawEntityFromState(state);
    }
  }

  _drawEntityFromState(state) {
    const nr = this._nr;
    switch (state.type) {
      case ENTITY_TYPE.SHIP:
        nr.polygon(
          _shipPts(state.x, state.y, state.angle),
          state.flags & 0x02 ? COLOR.SHIELD : COLOR.SHIP,
        );
        break;
      case ENTITY_TYPE.ASTEROID:
        nr.circle(state.x, state.y, 26, COLOR.ASTEROID, 1.5);
        break;
      case ENTITY_TYPE.BULLET:
        nr.dot(state.x, state.y, 3, COLOR.BULLET);
        break;
      case ENTITY_TYPE.UFO:
        nr.circle(state.x, state.y, 22, COLOR.UFO, 1.5);
        break;
      case ENTITY_TYPE.BLACK_HOLE:
        nr.circle(state.x, state.y, 22, COLOR.BLACK_HOLE, 2);
        break;
    }
  }

  // ─── Network ─────────────────────────────────────────────────────────────

  _gatherNetEntities() {
    const list = [];
    list.push(this._player.toNetState(ENTITY_TYPE.SHIP));
    if (this._remote) list.push(this._remote.toNetState(ENTITY_TYPE.SHIP));
    for (const a of this._asteroids.filter(a => a.alive)) list.push(a.toNetState());
    for (const b of this._bullets)  list.push(b.toNetState());
    for (const u of this._ufos.filter(u => u.alive)) list.push(u.toNetState());
    for (const h of this._holes)    list.push(h.toNetState());
    return list;
  }

  _setupNetCallbacks() {
    this._nm._callbacks.onDisconnect = () => {
      // Degrade to solo gracefully
      this._isHost   = true;
      this._isClient = false;
      this._showCenterText('OPPONENT DISCONNECTED', 2500);
    };

    if (this._role === NET_ROLE.CLIENT) {
      this._nm._callbacks.onEvent = (ev) => {
        if (ev.eventId === EVT.SCORE)     this._score    = ev.data;
        if (ev.eventId === EVT.LIVES)     this._player.lives = ev.data;
        if (ev.eventId === EVT.LEVEL)     this._level    = ev.data;
        if (ev.eventId === EVT.GAME_OVER) this._gameOver();
        this._updateHUD();
      };
    }
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────

  _buildHUD() {
    const style = (size, col = '#00ffcc') => ({
      fontSize: `${size}px`, fontFamily: 'Courier New', color: col,
    });

    this._hudScore = this.add.text(16,   12, 'SCORE\n0',      style(16)).setDepth(10).setScrollFactor(0);
    this._hudLevel = this.add.text(CANVAS_WIDTH / 2, 12, `LEVEL\n${this._level}`, style(16)).setDepth(10).setOrigin(0.5, 0).setScrollFactor(0);
    this._hudHi    = this.add.text(CANVAS_WIDTH - 16, 12, `HI\n${this._hiScore}`, style(14, '#888888')).setDepth(10).setOrigin(1, 0).setScrollFactor(0);
    this._hudLives = this.add.text(16, CANVAS_HEIGHT - 30, '', style(14)).setDepth(10).setScrollFactor(0);

    this._centerText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, '', {
      fontSize: '36px', fontFamily: 'Courier New', color: '#ffffff',
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);

    this._pwrText = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20, '', {
      fontSize: '20px', fontFamily: 'Courier New', color: '#ffdd44',
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0);

    // Static star field (background layer) – spread across the larger world
    // Maintain same density as the original 3840×2880 world (400 stars)
    const baseWorldArea = 3840 * 2880;
    const starCount = Math.round(400 * (WORLD_WIDTH * WORLD_HEIGHT) / baseWorldArea);
    for (let i = 0; i < starCount; i++) {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
      const r = Math.random() < 0.15 ? 2 : 1;
      this.add.rectangle(x, y, r, r, 0xaaffff, 0.25 + Math.random() * 0.2).setDepth(-2);
    }
  }

  _updateHUD() {
    this._hudScore?.setText(`SCORE\n${this._score}`);
    this._hudLevel?.setText(`LEVEL\n${this._level}`);
    this._hudHi?.setText(`HI\n${this._hiScore}`);

    // Lives icons (triangle per life)
    const livesStr = '△ '.repeat(Math.max(0, this._player.lives));
    this._hudLives?.setText(livesStr);

    // Shield bar
    if (this._player.shieldHP > 0) {
      const bars = Math.round(this._player.shieldHP / 10);
      const str  = '■'.repeat(bars) + '□'.repeat(10 - bars);
      this._hudLives?.setText(livesStr + `  S:${str}`);
    }
  }

  _showCenterText(msg, durationMs = 2000) {
    this._centerText?.setText(msg).setAlpha(1);
    this.tweens.add({
      targets: this._centerText,
      alpha: 0,
      duration: 400,
      delay: durationMs - 400,
    });
  }

  _showPowerupText(type) {
    const labels = {
      shield_restore: 'SHIELD RESTORED',
      rapid_fire:     'RAPID FIRE!',
      railgun:        'RAILGUN!',
      black_hole:     'BLACK HOLE DEPLOYED!',
    };
    this._pwrText?.setText(labels[type] || type.toUpperCase()).setAlpha(1);
    this.tweens.add({
      targets: this._pwrText,
      alpha: 0,
      duration: 300,
      delay: 1200,
    });
  }

  // ─── Minimap ─────────────────────────────────────────────────────────────

  _buildMinimap() {
    // Minimap constants
    this._mmW = 180;   // minimap width in pixels
    this._mmH = 135;   // minimap height in pixels (keeps 4:3 aspect of world)
    this._mmX = 10;    // top-left corner X
    this._mmY = 50;    // top-left corner Y (below score)

    // Scale factors: world → minimap
    this._mmScaleX = this._mmW / WORLD_WIDTH;
    this._mmScaleY = this._mmH / WORLD_HEIGHT;

    // Graphics object for minimap – fixed to camera
    this._mmGfx = this.add.graphics().setDepth(15).setScrollFactor(0);
  }

  _drawMinimap() {
    const g  = this._mmGfx;
    if (!g) return;
    g.clear();

    const mx = this._mmX, my = this._mmY;
    const mw = this._mmW, mh = this._mmH;
    const sx = this._mmScaleX, sy = this._mmScaleY;

    // Background
    g.fillStyle(0x000000, 0.55);
    g.fillRect(mx, my, mw, mh);
    g.lineStyle(1, 0x00ffcc, 0.6);
    g.strokeRect(mx, my, mw, mh);

    // Camera viewport rectangle
    const cam = this.cameras.main;
    const vx = cam.scrollX * sx + mx;
    const vy = cam.scrollY * sy + my;
    const vw = CANVAS_WIDTH * sx;
    const vh = CANVAS_HEIGHT * sy;
    g.lineStyle(1, 0x00ffcc, 0.4);
    g.strokeRect(vx, vy, vw, vh);

    // Asteroids (orange dots)
    g.fillStyle(0xff8800, 0.8);
    for (const a of this._asteroids) {
      if (!a.alive) continue;
      g.fillRect(mx + a.x * sx - 1, my + a.y * sy - 1, 2, 2);
    }

    // UFOs (magenta dots)
    g.fillStyle(0xff00ff, 0.9);
    for (const u of this._ufos) {
      if (!u.alive) continue;
      g.fillRect(mx + u.x * sx - 1, my + u.y * sy - 1, 3, 3);
    }

    // Black holes (purple dots)
    g.fillStyle(0x8800ff, 0.9);
    for (const h of this._holes) {
      if (!h.alive) continue;
      g.fillCircle(mx + h.x * sx, my + h.y * sy, 2);
    }

    // Powerups (yellow dots)
    g.fillStyle(0xffdd44, 0.9);
    for (const p of this._powerups) {
      if (!p.alive) continue;
      g.fillRect(mx + p.x * sx - 1, my + p.y * sy - 1, 2, 2);
    }

    // Player (bright cyan dot, larger)
    if (this._player.alive) {
      g.fillStyle(0x00ffff, 1);
      g.fillCircle(mx + this._player.x * sx, my + this._player.y * sy, 3);
    }

    // Remote player (green dot)
    if (this._remote?.alive) {
      g.fillStyle(0x00ff00, 1);
      g.fillCircle(mx + this._remote.x * sx, my + this._remote.y * sy, 3);
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  shutdown() {
    this._input?.destroy();
    this._nr?.destroy();
    this._mmGfx?.destroy();
    if (this._nm) {
      this._nm._callbacks = {};
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _shipPts(x, y, angle) {
  const R   = 14;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const rot = (lx, ly) => ({
    x: x + cos * ly + sin * lx,
    y: y - sin * ly + cos * lx,
  });
  return [rot(0, -R - 2), rot(-10, R - 2), rot(0, R - 7), rot(10, R - 2)];
}
