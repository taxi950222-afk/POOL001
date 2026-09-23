import { NOSE_H, R } from '../spec.ts'
import {
  mountAxes,
  pocketMounts,
  pocketParams,
  type PocketId,
  type PocketMount,
  type PocketParams,
} from './params.ts'

/** Segment length target. 0.2 * R. */
export const SEG_LEN = 0.2 * R
export const FUNNEL_GAMMA = 2.75
const G = 9.81

export interface CcdPlan {
  n: number
  scale: number
  overflow: boolean
  travel: number
  maxSubsteps: number
}

/** maxSubsteps is 8 when dt is 1/600. A 1/60 step would use 24. */
export function ccdPlan(speed: number, dt: number): CcdPlan {
  const maxSubsteps = dt >= 1 / 90 ? 24 : 8
  const want = speed * dt
  let n = want > SEG_LEN ? Math.ceil(want / SEG_LEN - 1e-9) : 1
  let travel = want
  let overflow = false
  if (n > maxSubsteps) {
    n = maxSubsteps
    travel = maxSubsteps * SEG_LEN
    overflow = true
  }
  const scale = want > 1e-12 ? travel / want : 1
  return { n, scale, overflow, travel, maxSubsteps }
}

interface Body {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  wx: number
  wy: number
  wz: number
  state: 'live' | 'pocket' | 'off'
}

export interface PocketContact {
  nx: number
  ny: number
  nz: number
  pen: number
  /** Jaw pushes the ball back toward the table while it has not crossed. */
  blocksPocket: boolean
  inelastic: boolean
}

interface Local {
  x: number
  y: number
  z: number
}

interface JawGeom {
  c0x: number
  zT: number
  r: number
  throatHalf: number
  mouthHalf: number
  c1x: number
  c1z: number
}

function cornerJaw(p: PocketParams): JawGeom {
  const mouthHalf = p.mouthWidth / 2
  const throatHalf = p.throatWidth / 2
  const r = p.jawRadius
  const c0x = throatHalf + r
  const zT = mouthHalf - c0x + r * Math.SQRT2
  const n = Math.SQRT1_2
  return { c0x, zT, r, throatHalf, mouthHalf, c1x: c0x - r * n, c1z: zT - r * n }
}

function sideJaw(p: PocketParams): JawGeom {
  const mouthHalf = p.mouthWidth / 2
  const throatHalf = p.throatWidth / 2
  const r = p.jawRadius
  const c0x = throatHalf + r
  return { c0x, zT: r, r, throatHalf, mouthHalf, c1x: c0x, c1z: 0 }
}

function jawGeom(mount: PocketMount): JawGeom {
  const p = pocketParams(mount.kind)
  return mount.kind === 'corner' ? cornerJaw(p) : sideJaw(p)
}

export function toLocal(mount: PocketMount, x: number, y: number, z: number): Local {
  const a = mountAxes(mount)
  const dx = x - mount.x
  const dz = z - mount.z
  return {
    x: dx * a.xx + dz * a.xz,
    y: y - mount.y,
    z: dx * a.zx + dz * a.zz,
  }
}

export function fromLocal(mount: PocketMount, x: number, y: number, z: number) {
  const a = mountAxes(mount)
  return {
    x: mount.x + x * a.xx + z * a.zx,
    y: mount.y + y,
    z: mount.z + x * a.xz + z * a.zz,
  }
}

function localNormalToWorld(mount: PocketMount, nx: number, ny: number, nz: number) {
  const a = mountAxes(mount)
  return {
    nx: nx * a.xx + nz * a.zx,
    ny,
    nz: nx * a.xz + nz * a.zz,
  }
}

export function overPocketMouth(x: number, y: number, z: number): boolean {
  for (const mount of pocketMounts()) {
    const L = toLocal(mount, x, y, z)
    const p = pocketParams(mount.kind)
    if (L.z > 0 && L.z < p.depth + 0.85 && Math.abs(L.x) < p.mouthWidth / 2 && L.y > -p.drop - 0.02 && L.y < R + 0.04) {
      return true
    }
  }
  return false
}

function sphereBox(
  c: Local,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): { nx: number; ny: number; nz: number; pen: number } | null {
  const inside =
    c.x > minX && c.x < maxX && c.y > minY && c.y < maxY && c.z > minZ && c.z < maxZ
  if (inside) {
    const faces = [
      { pen: c.x - minX, nx: -1, ny: 0, nz: 0 },
      { pen: maxX - c.x, nx: 1, ny: 0, nz: 0 },
      { pen: c.y - minY, nx: 0, ny: -1, nz: 0 },
      { pen: maxY - c.y, nx: 0, ny: 1, nz: 0 },
      { pen: c.z - minZ, nx: 0, ny: 0, nz: -1 },
      { pen: maxZ - c.z, nx: 0, ny: 0, nz: 1 },
    ]
    let best = faces[0]
    for (const f of faces) if (f && best && f.pen < best.pen) best = f
    if (!best) return null
    return { nx: best.nx, ny: best.ny, nz: best.nz, pen: best.pen + R }
  }
  const qx = Math.max(minX, Math.min(maxX, c.x))
  const qy = Math.max(minY, Math.min(maxY, c.y))
  const qz = Math.max(minZ, Math.min(maxZ, c.z))
  const dx = c.x - qx
  const dy = c.y - qy
  const dz = c.z - qz
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 >= R * R || d2 < 1e-16) return null
  const d = Math.sqrt(d2)
  return { nx: dx / d, ny: dy / d, nz: dz / d, pen: R - d }
}

function capsuleHit(c: Local, ax: number, az: number, radius: number) {
  const dx = c.x - ax
  const dz = c.z - az
  const d = Math.hypot(dx, dz)
  const min = R + radius
  if (d >= min) return null
  if (d < 1e-8) return { nx: 0, ny: 0, nz: -1, pen: min }
  return { nx: dx / d, ny: 0, nz: dz / d, pen: min - d }
}

function segHit(c: Local, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax
  const abz = bz - az
  const ab2 = abx * abx + abz * abz || 1
  let t = ((c.x - ax) * abx + (c.z - az) * abz) / ab2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + abx * t
  const cz = az + abz * t
  const dx = c.x - cx
  const dz = c.z - cz
  const d = Math.hypot(dx, dz)
  if (d >= R || d < 1e-8) return null
  return { nx: dx / d, ny: 0, nz: dz / d, pen: R - d }
}

function pushContact(
  out: PocketContact[],
  mount: PocketMount,
  local: Local,
  hit: { nx: number; ny: number; nz: number; pen: number },
  jaw: boolean,
  inelastic: boolean,
) {
  if (hit.pen < 1e-8) return
  const w = localNormalToWorld(mount, hit.nx, hit.ny, hit.nz)
  const len = Math.hypot(w.nx, w.ny, w.nz) || 1
  const p = pocketParams(mount.kind)
  const signed = p.zCapture - local.z
  const blocksPocket = jaw && hit.nz < 0 && signed >= 0
  out.push({
    nx: w.nx / len,
    ny: w.ny / len,
    nz: w.nz / len,
    pen: hit.pen,
    blocksPocket,
    inelastic,
  })
}

/** Convex jaw capsules, shelf, throat walls, and the side back wall. */
export function pocketContacts(x: number, y: number, z: number): PocketContact[] {
  const out: PocketContact[] = []
  for (const mount of pocketMounts()) {
    const L = toLocal(mount, x, y, z)
    if (L.z < -0.35 || L.z > 1.3 || Math.abs(L.x) > 0.4 || L.y < -0.4 || L.y > 0.2) continue
    const p = pocketParams(mount.kind)
    const g = jawGeom(mount)
    const y0 = -0.02
    const y1 = NOSE_H
    if (L.y > y0 - R && L.y < y1 + R) {
      const right = capsuleHit(L, g.c0x, g.zT, g.r)
      const left = capsuleHit(L, -g.c0x, g.zT, g.r)
      if (right) pushContact(out, mount, L, right, true, false)
      if (left) pushContact(out, mount, L, left, true, false)
    }
    const wallY0 = -p.drop
    const wallY1 = NOSE_H
    const wallZ1 = p.depth + 0.55
    const thick = 0.04
    const rightWall = sphereBox(L, g.throatHalf, wallY0, g.zT, g.throatHalf + thick, wallY1, wallZ1)
    const leftWall = sphereBox(L, -g.throatHalf - thick, wallY0, g.zT, -g.throatHalf, wallY1, wallZ1)
    if (rightWall) pushContact(out, mount, L, rightWall, false, false)
    if (leftWall) pushContact(out, mount, L, leftWall, false, false)

    const shelf = p.shelfChamfer
    const lipR = sphereBox(L, g.throatHalf, -shelf, 0, g.mouthHalf, 0, shelf)
    const lipL = sphereBox(L, -g.mouthHalf, -shelf, 0, -g.throatHalf, 0, shelf)
    if (lipR) pushContact(out, mount, L, lipR, false, false)
    if (lipL) pushContact(out, mount, L, lipL, false, false)

    if (mount.kind === 'corner') {
      const noseR = segHit(L, g.mouthHalf, 0, g.c1x, g.c1z)
      const noseL = segHit(L, -g.mouthHalf, 0, -g.c1x, g.c1z)
      if (noseR) pushContact(out, mount, L, noseR, true, false)
      if (noseL) pushContact(out, mount, L, noseL, true, false)
    } else {
      const noseR = segHit(L, g.mouthHalf, 0, g.c1x, g.c1z)
      const noseL = segHit(L, -g.mouthHalf, 0, -g.c1x, g.c1z)
      if (noseR) pushContact(out, mount, L, noseR, true, false)
      if (noseL) pushContact(out, mount, L, noseL, true, false)
      const tilt = (p.backTilt * Math.PI) / 180
      const nx = 0
      const ny = -Math.sin(tilt)
      const nz = -Math.cos(tilt)
      const px = 0
      const py = 0
      const pz = p.depth
      const gap = nx * (L.x - px) + ny * (L.y - py) + nz * (L.z - pz)
      if (gap < R && Math.abs(L.x) < g.throatHalf + 0.03 && L.y < 0.03 && L.y > -p.drop - 0.01 && L.z > p.zCapture - 0.02) {
        pushContact(out, mount, L, { nx, ny, nz, pen: R - gap }, false, false)
      }
    }

    if (L.z > 0 && L.z < p.depth + 0.6 && Math.abs(L.x) < g.mouthHalf + 0.02 && L.y < -p.drop) {
      pushContact(out, mount, L, { nx: 0, ny: 1, nz: 0, pen: -p.drop - L.y }, false, true)
    }
  }
  out.sort((a, b) => b.pen - a.pen)
  return out
}

const grazeBlock = new WeakSet<object>()

export function notePocketBlock(body: object) {
  grazeBlock.add(body)
}

function onJaw(mount: PocketMount, L: Local): boolean {
  const g = jawGeom(mount)
  const min = g.r + R - 0.0008
  return Math.hypot(L.x - g.c0x, L.z - g.zT) < min || Math.hypot(L.x + g.c0x, L.z - g.zT) < min
}

interface Track {
  id: PocketId
  age: number
  slow: number
  rested: boolean
  fresh: boolean
}

const tracks = new WeakMap<object, Track>()

export function clearPocketTrack(body: object) {
  tracks.delete(body)
  grazeBlock.delete(body)
}

/**
 * signed_distance = zCapture - z. Crossed only when that is < 0.
 * Also requires the center inside the throat, below the cloth by half a radius, and off the jaw.
 */
export function tryPocket(body: Body): number | null {
  if (body.state !== 'live') return null
  const blocked = grazeBlock.has(body)
  grazeBlock.delete(body)
  if (blocked) return null
  let best: { mount: PocketMount; speed: number; signed: number } | null = null
  for (const mount of pocketMounts()) {
    const L = toLocal(mount, body.x, body.y, body.z)
    const p = pocketParams(mount.kind)
    const signed = p.zCapture - L.z
    if (!(signed < 0)) continue
    if (!(Math.abs(L.x) < p.throatWidth / 2)) continue
    if (!(L.y < -0.5 * R)) continue
    if (onJaw(mount, L)) continue
    const speed = Math.hypot(body.vx, body.vy, body.vz)
    if (!best || signed < best.signed) best = { mount, speed, signed }
  }
  if (!best) return null
  body.state = 'pocket'
  tracks.set(body, { id: best.mount.id, age: 0, slow: 0, rested: false, fresh: true })
  return best.speed
}

function mountById(id: PocketId): PocketMount {
  const found = pocketMounts().find((m) => m.id === id)
  if (!found) throw new Error(id)
  return found
}

function writeLocalVel(mount: PocketMount, body: Body, lx: number, ly: number, lz: number, vx: number, vy: number, vz: number) {
  const w = fromLocal(mount, lx, ly, lz)
  const a = mountAxes(mount)
  body.x = w.x
  body.y = w.y
  body.z = w.z
  body.vx = vx * a.xx + vz * a.zx
  body.vy = vy
  body.vz = vx * a.xz + vz * a.zz
}

/** Scripted funnel after a real pocket. Clock starts at the crossing. */
export function integratePocketed(body: Body, dt: number) {
  const track = tracks.get(body)
  if (!track || body.state !== 'pocket' || track.rested) return
  track.age += dt
  if (track.fresh) {
    track.fresh = false
    return
  }
  const mount = mountById(track.id)
  const p = pocketParams(mount.kind)
  const a = mountAxes(mount)
  const L = toLocal(mount, body.x, body.y, body.z)
  let vx = body.vx * a.xx + body.vz * a.xz
  let vy = body.vy
  let vz = body.vx * a.zx + body.vz * a.zz
  const damp = Math.exp(-FUNNEL_GAMMA * dt)
  vx *= damp
  vy *= damp
  vz *= damp
  vy -= G * dt
  let x = L.x + vx * dt
  let y = L.y + vy * dt
  let z = L.z + vz * dt
  const g = jawGeom(mount)
  const open = g.throatHalf - R + Math.max(0, -y) * 0.45 + Math.max(0, z - p.zCapture) * 0.15
  if (x > open) {
    x = open
    if (vx > 0) vx = 0
  } else if (x < -open) {
    x = -open
    if (vx < 0) vx = 0
  }
  if (z < p.zCapture) {
    z = p.zCapture
    if (vz < 0) vz = 0
  }
  const zMax = p.depth
  if (z > zMax) {
    z = zMax
    if (vz > 0) vz = 0
  }
  if (y < -p.drop) {
    y = -p.drop
    if (vy < 0) vy = 0
  }
  if (y > R) {
    y = R
    if (vy > 0) vy = 0
  }
  writeLocalVel(mount, body, x, y, z, vx, vy, vz)
  const speed = Math.hypot(body.vx, body.vy, body.vz)
  if (speed < 0.02) track.slow += dt
  else track.slow = 0
  if (track.slow >= 0.4) {
    body.vx = body.vy = body.vz = 0
    body.wx = body.wy = body.wz = 0
    track.rested = true
    return
  }
  if (track.age >= 3) {
    const rest = fromLocal(mount, 0, -p.drop, p.depth)
    body.x = rest.x
    body.y = rest.y
    body.z = rest.z
    body.vx = body.vy = body.vz = 0
    body.wx = body.wy = body.wz = 0
    track.rested = true
  }
}

export function pocketDebug(body: object): { age: number; slow: number; rested: boolean; id: PocketId } | null {
  const track = tracks.get(body)
  if (!track) return null
  return { age: track.age, slow: track.slow, rested: track.rested, id: track.id }
}

export function localOf(mount: PocketMount, x: number, y: number, z: number) {
  return toLocal(mount, x, y, z)
}

/** Old circular jaws sit on the same tips as the new capsules. The capsule is the jaw. */
export function legacyJawReplaced(x: number, z: number): boolean {
  for (const mount of pocketMounts()) {
    const g = jawGeom(mount)
    for (const sx of [1, -1]) {
      const c = fromLocal(mount, sx * g.c0x, 0, g.zT)
      if (Math.hypot(x - c.x, z - c.z) < 0.045) return true
    }
  }
  return false
}
