/** Meter/second units. Both the trajectory and live shots use this fixed-step solver. */
export const STEP = 1 / 240;
export const GRAVITY = 9.81;
export const BALL_RADIUS = 0.105;
export const AIR_DRAG = 0.055;
export type V3 = { x: number; y: number; z: number };
export type Basket = { x: number; z: number; height: number; radius: number; bottomRadius: number; rim: number };
export type Obstacle = { min: V3; max: V3 };
export type BallState = { position: V3; velocity: V3; age: number; scored: boolean; inside: boolean; settled: boolean; bounces: number };
export type Collision = 'rim' | 'floor' | 'wall' | 'score' | null;
export const ORIGIN: V3 = { x: 0.28, y: 1.38, z: 5.1 };
export const OFFICE_BIN: Basket = { x: 0.5, z: -2.3, height: 0.96, radius: 0.46, bottomRadius: 0.33, rim: 0.024 };
export const BEACH_BIN: Basket = { x: 0.1, z: -3.0, height: 0.94, radius: 0.43, bottomRadius: 0.37, rim: 0.032 };
export function launch(power: number, yaw: number, elevation: number): BallState {
  const speed = 5 + power * 0.07;
  const angle = elevation * Math.PI / 180;
  return { position: { ...ORIGIN }, velocity: { x: Math.sin(yaw) * Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: -Math.cos(yaw) * Math.cos(angle) * speed }, age: 0, scored: false, inside: false, settled: false, bounces: 0 };
}
function reflect(v: V3, n: V3, restitution: number) {
  const vn = v.x * n.x + v.y * n.y + v.z * n.z;
  if (vn >= 0) return;
  v.x -= (1 + restitution) * vn * n.x;
  v.y -= (1 + restitution) * vn * n.y;
  v.z -= (1 + restitution) * vn * n.z;
  v.x *= .87; v.y *= .94; v.z *= .87;
}
export function advance(ball: BallState, bin: Basket, obstacles: Obstacle[] = [], dt = STEP): Collision {
  if (ball.settled) return null;
  const p = ball.position, v = ball.velocity;
  const previous = { ...p };
  ball.age += dt;
  const speed = Math.hypot(v.x, v.y, v.z);
  v.x -= AIR_DRAG * speed * v.x * dt;
  v.y -= (GRAVITY + AIR_DRAG * speed * v.y) * dt;
  v.z -= AIR_DRAG * speed * v.z * dt;
  p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
  let event: Collision = null;
  let dx = p.x - bin.x, dz = p.z - bin.z;
  let radial = Math.hypot(dx, dz);
  // Collision with the actual circular rim, resolved against the torus centerline.
  const ringX = bin.x + dx / (radial || 1) * bin.radius;
  const ringZ = bin.z + dz / (radial || 1) * bin.radius;
  const rx = p.x - ringX, ry = p.y - bin.height, rz = p.z - ringZ;
  const ringDistance = Math.hypot(rx, ry, rz);
  const collisionRadius = BALL_RADIUS + bin.rim;
  if (ringDistance < collisionRadius && ringDistance > 0.00001) {
    const n = { x: rx / ringDistance, y: ry / ringDistance, z: rz / ringDistance };
    const depth = collisionRadius - ringDistance;
    p.x += n.x * depth; p.y += n.y * depth; p.z += n.z * depth;
    reflect(v, n, .47); event = 'rim';
    dx = p.x - bin.x; dz = p.z - bin.z; radial = Math.hypot(dx, dz);
  }
  // A make requires the whole paper ball to pass through the opening from above.
  const entryHeight = bin.height - BALL_RADIUS;
  if (!ball.scored && v.y < 0 && previous.y >= entryHeight && p.y < entryHeight) {
    const mix = (previous.y - entryHeight) / (previous.y - p.y);
    const crossingX = previous.x + (p.x - previous.x) * mix;
    const crossingZ = previous.z + (p.z - previous.z) * mix;
    if (Math.hypot(crossingX - bin.x, crossingZ - bin.z) < bin.radius - BALL_RADIUS - bin.rim) {
      ball.scored = true; ball.inside = true; event = 'score';
    }
  }
  if (p.y > .04 && p.y < bin.height - bin.rim) {
    const wallRadius = bin.bottomRadius + (bin.radius - bin.bottomRadius) * Math.max(0, p.y / bin.height);
    if (ball.inside && radial > wallRadius - BALL_RADIUS) {
      const n = { x: -dx / (radial || 1), y: .04, z: -dz / (radial || 1) };
      p.x = bin.x + dx / (radial || 1) * (wallRadius - BALL_RADIUS);
      p.z = bin.z + dz / (radial || 1) * (wallRadius - BALL_RADIUS);
      reflect(v, n, .25);
    } else if (!ball.inside && radial < wallRadius + BALL_RADIUS && radial > wallRadius - BALL_RADIUS) {
      const n = { x: dx / (radial || 1), y: 0, z: dz / (radial || 1) };
      p.x = bin.x + n.x * (wallRadius + BALL_RADIUS);
      p.z = bin.z + n.z * (wallRadius + BALL_RADIUS);
      reflect(v, n, .3); event ??= 'wall';
    }
  }
  for (const box of obstacles) {
    const q = { x: Math.max(box.min.x, Math.min(p.x, box.max.x)), y: Math.max(box.min.y, Math.min(p.y, box.max.y)), z: Math.max(box.min.z, Math.min(p.z, box.max.z)) };
    const x = p.x - q.x, y = p.y - q.y, z = p.z - q.z;
    const distance = Math.hypot(x, y, z);
    if (distance < BALL_RADIUS && distance > 1e-6) {
      const n = { x: x / distance, y: y / distance, z: z / distance };
      p.x = q.x + n.x * BALL_RADIUS; p.y = q.y + n.y * BALL_RADIUS; p.z = q.z + n.z * BALL_RADIUS;
      reflect(v, n, .28); event ??= 'wall';
    }
  }
  const floor = BALL_RADIUS + (ball.inside ? .06 : 0);
  if (p.y < floor) {
    p.y = floor;
    if (v.y < -.35) { ball.bounces++; event ??= 'floor'; }
    v.y = Math.abs(v.y) * .24; v.x *= .7; v.z *= .7;
    if (Math.hypot(v.x, v.z) < .15 && v.y < .4) { ball.settled = true; v.x = 0; v.y = 0; v.z = 0; }
  }
  if (p.x < -7.7 || p.x > 7.7) { p.x = Math.max(-7.7, Math.min(7.7, p.x)); v.x *= -.35; event ??= 'wall'; }
  if (p.z < -8.8) { p.z = -8.8; v.z *= -.35; event ??= 'wall'; }
  if (p.y > 4.25 - BALL_RADIUS && bin === OFFICE_BIN) { p.y = 4.25 - BALL_RADIUS; v.y = -Math.abs(v.y) * .3; event ??= 'wall'; }
  if (ball.age > 6) ball.settled = true;
  return event;
}
export function trajectory(power: number, yaw: number, elevation: number, bin: Basket, obstacles: Obstacle[] = []) {
  const ball = launch(power, yaw, elevation);
  const points: V3[] = [];
  for (let i = 0; i < 900; i++) {
    const event = advance(ball, bin, obstacles);
    if (i % 9 === 0) points.push({ ...ball.position });
    if (event === 'score' || event === 'floor' || ball.settled) break;
  }
  return { points, makes: ball.scored };
}
