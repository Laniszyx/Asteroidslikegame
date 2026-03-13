# Neon Vector — P2P Asteroids Shooter

A neon-styled Asteroids-like arcade shooter built with **Phaser 3** and **PeerJS**. Play solo or with a friend via peer-to-peer multiplayer — no server required.

## Play the Game

### Online

Once GitHub Pages is enabled, the game is available at:\
**https://laniszyx.github.io/Asteroidslikegame/**

> To enable GitHub Pages, go to **Settings → Pages** in this repository and set the source to **GitHub Actions**. The included deploy workflow will automatically build and publish on every push to `main`.

### Locally

```bash
git clone https://github.com/Laniszyx/Asteroidslikegame.git
cd Asteroidslikegame
npm install
npm run dev
```

The dev server opens at `http://localhost:3000`.

## Controls

| Action       | Key                        |
| ------------ | -------------------------- |
| Thrust       | `W` / `↑`                 |
| Rotate left  | `A` / `←`                 |
| Rotate right | `D` / `→`                 |
| Fire         | `Space`                    |
| Shield       | `Shift`                    |

## How to Play

1. **Solo Play** — Click *SOLO PLAY* on the title screen to jump straight in.
2. **Host a Room** — Click *HOST ROOM*, then share the Room ID with a friend.
3. **Join a Room** — Click *JOIN ROOM* and paste the host's Room ID to connect.

Destroy asteroids to score points and advance levels. Collect power-ups that drop from destroyed asteroids:

| Power-up       | Label | Effect                                          |
| -------------- | ----- | ------------------------------------------------ |
| Shield Restore | **S** | Restores shield to full                          |
| Rapid Fire     | **R** | Removes fire cooldown for 8 seconds              |
| Railgun        | **G** | Switches weapon to a piercing railgun            |
| Black Hole     | **B** | Spawns a gravity well that pulls in nearby objects |

Starting at level 2, UFOs begin to appear. Small UFOs (level 5+) actively chase you and are worth 1,000 points.

### Game Over

When all lives are lost the game ends. Press **Enter**, **Space**, or click to restart. Press **Escape** to return to the lobby. High scores are saved locally in your browser.

## Scoring

| Target          | Points |
| --------------- | ------ |
| Large asteroid  | 20     |
| Medium asteroid | 50     |
| Small asteroid  | 100    |
| Large UFO       | 200    |
| Small UFO       | 1,000  |

## Project Structure

```
src/
├── main.js              # Phaser game configuration & entry point
├── config.js            # Game constants (speeds, sizes, colors)
├── scenes/              # Boot → Lobby → Game → GameOver
├── entities/            # Ship, Asteroid, Bullet, UFO, BlackHole, Powerup
├── systems/             # Collision, Input, Object Pool, Weapon FSM
├── network/             # PeerJS networking, serialization, snapshots
├── physics/             # PhysicsBody, Quadtree
├── rendering/           # Neon glow pipeline, procedural drawing
└── ai/                  # UFO steering behaviors
```

## Building for Production

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

## Tech Stack

- **[Phaser 3](https://phaser.io/)** — game engine (WebGL, arcade physics)
- **[PeerJS](https://peerjs.com/)** — WebRTC peer-to-peer networking
- **[Vite](https://vitejs.dev/)** — build tooling & dev server
