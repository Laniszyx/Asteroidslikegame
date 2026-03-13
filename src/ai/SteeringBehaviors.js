import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

/**
 * SteeringBehaviors – autonomous movement for UFO AI agents.
 *
 * Returns acceleration vectors (ax, ay) that are added to the agent's velocity.
 * All behaviours use toroidal shortest-path vectors.
 */

// ─── Utility ────────────────────────────────────────────────────────────────

function _toroidalDelta(ax, ay, bx, by) {
  let dx = bx - ax;
  let dy = by - ay;
  if (dx >  CANVAS_WIDTH  / 2) dx -= CANVAS_WIDTH;
  if (dx < -CANVAS_WIDTH  / 2) dx += CANVAS_WIDTH;
  if (dy >  CANVAS_HEIGHT / 2) dy -= CANVAS_HEIGHT;
  if (dy < -CANVAS_HEIGHT / 2) dy += CANVAS_HEIGHT;
  return { dx, dy };
}

function _len(x, y) { return Math.hypot(x, y) || 1e-9; }

function _normalize(x, y) {
  const l = _len(x, y);
  return { x: x / l, y: y / l };
}

// ─── Individual behaviours ───────────────────────────────────────────────────

/**
 * Seek – steer toward target at max speed.
 * @returns {{ ax:number, ay:number }}
 */
export function seek(agent, tx, ty, maxSpeed, maxForce) {
  const { dx, dy } = _toroidalDelta(agent.x, agent.y, tx, ty);
  const n = _normalize(dx, dy);
  const desiredVx = n.x * maxSpeed;
  const desiredVy = n.y * maxSpeed;
  return {
    ax: _clamp(desiredVx - agent.vx, -maxForce, maxForce),
    ay: _clamp(desiredVy - agent.vy, -maxForce, maxForce),
  };
}

/**
 * Flee – steer away from target.
 */
export function flee(agent, tx, ty, maxSpeed, maxForce) {
  const s = seek(agent, tx, ty, maxSpeed, maxForce);
  return { ax: -s.ax, ay: -s.ay };
}

/**
 * Arrive – seek with deceleration near target.
 * @param {number} slowingRadius  pixels
 */
export function arrive(agent, tx, ty, maxSpeed, maxForce, slowingRadius = 120) {
  const { dx, dy } = _toroidalDelta(agent.x, agent.y, tx, ty);
  const dist = _len(dx, dy);
  const n    = _normalize(dx, dy);
  const speed = dist < slowingRadius ? maxSpeed * (dist / slowingRadius) : maxSpeed;
  return {
    ax: _clamp(n.x * speed - agent.vx, -maxForce, maxForce),
    ay: _clamp(n.y * speed - agent.vy, -maxForce, maxForce),
  };
}

/**
 * Predictive pursuit – intercept a moving target by leading its position.
 * @param {{ x,y,vx,vy }} target
 */
export function pursue(agent, target, maxSpeed, maxForce) {
  const { dx, dy } = _toroidalDelta(agent.x, agent.y, target.x, target.y);
  const dist = _len(dx, dy);
  const lookAheadTime = dist / (maxSpeed + 1e-6);
  const fx = target.x + target.vx * lookAheadTime;
  const fy = target.y + target.vy * lookAheadTime;
  return seek(agent, fx, fy, maxSpeed, maxForce);
}

/**
 * Obstacle Avoidance via Probe-Box (raycasting alternative).
 * Casts two angled probes ahead; if a probe intersects an obstacle circle,
 * generates a lateral steering force.
 *
 * @param {Array<{x,y,radius}>} obstacles
 * @param {number} probeLen   length of probe rays (pixels)
 */
export function avoidObstacles(agent, obstacles, maxForce, probeLen = 90) {
  const heading  = agent.angle;  // radians
  const hx = Math.sin(heading);
  const hy = -Math.cos(heading);

  // Left and right probe offsets (15° apart)
  const probes = [
    { ox: hx,  oy: hy  },  // forward
    { ox:  Math.sin(heading + 0.26) * probeLen, oy: -Math.cos(heading + 0.26) * probeLen },
    { ox:  Math.sin(heading - 0.26) * probeLen, oy: -Math.cos(heading - 0.26) * probeLen },
  ];

  let bestForce = { ax: 0, ay: 0 };
  let closestDist = Infinity;

  for (const obs of obstacles) {
    if (!obs.alive) continue;
    const { dx, dy } = _toroidalDelta(agent.x, agent.y, obs.x, obs.y);
    const dist = _len(dx, dy) - obs.radius;
    if (dist > probeLen + obs.radius) continue;

    if (dist < closestDist) {
      closestDist = dist;
      // Lateral avoidance: push perpendicular to the obstacle vector
      const n  = _normalize(dx, dy);
      // perpendicular (choose side based on heading dot product)
      const perp = hx * (-n.y) + hy * n.x > 0
        ? { ax:  n.y * maxForce, ay: -n.x * maxForce }
        : { ax: -n.y * maxForce, ay:  n.x * maxForce };
      bestForce = perp;
    }
  }

  return bestForce;
}

/**
 * Wander – slight random perturbation for unpredictable UFO movement.
 * Modifies a persistent `wanderAngle` on the agent object.
 */
export function wander(agent, maxForce, wanderRadius = 40, wanderDist = 60) {
  if (agent._wanderAngle === undefined) agent._wanderAngle = Math.random() * Math.PI * 2;
  agent._wanderAngle += (Math.random() - 0.5) * 0.4;

  const cx = agent.x + Math.sin(agent.angle) * wanderDist;
  const cy = agent.y - Math.cos(agent.angle) * wanderDist;
  const wx = cx + Math.sin(agent._wanderAngle) * wanderRadius;
  const wy = cy - Math.cos(agent._wanderAngle) * wanderRadius;

  const n = _normalize(wx - agent.x, wy - agent.y);
  return { ax: n.x * maxForce * 0.3, ay: n.y * maxForce * 0.3 };
}

/**
 * Weighted force combination.
 * @param {Array<{force:{ax,ay}, weight:number}>} weighted
 */
export function combineForces(weighted) {
  let ax = 0, ay = 0;
  for (const { force, weight } of weighted) {
    ax += force.ax * weight;
    ay += force.ay * weight;
  }
  return { ax, ay };
}

function _clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
