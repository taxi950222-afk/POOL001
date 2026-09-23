import {
  BED,
  HALF_L,
  HALF_W,
  ORDER,
  R,
  RAIL,
  type BallId,
  type ObjectId,
  rackPositions,
  tableHardware,
} from './spec.ts'

export const TUNE = {
  maxCueSpeed: 7.7,
  muSlide: 0.18,
  muRoll: 0.044,
  eBall: 0.94,
  muBall: 0.05,
  eCush: 0.81,
  muCush: 0.2,
}

const M = 0.17
const G = 9.81
const I = 0.4 * M * R * R

export interface Ball {
  id: BallId
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

export interface World {
  balls: Ball[]
  firstContact: BallId | 'cushion' | null
  nineLast: BallId | null
}

export type SimEvent =
  | { t: 'ball'; speed: number }
  | { t: 'cushion'; speed: number }
  | { t: 'pocket'; id: BallId; speed: number }
  | { t: 'off'; id: BallId }

const HW = tableHardware()

export function createWorld(): World {
  const ids: BallId[] = ['cue', '1', '2', '3', '9']
  const balls: Ball[] = ids.map((id) => ({
    id,
    x: 0,
    y: BED + R,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    wx: 0,
    wy: 0,
    wz: 0,
    state: 'live',
  }))
  const world: World = { balls, firstContact: null, nineLast: null }
  rackBalls(world)
  return world
}

export function ball(world: World, id: BallId): Ball {
  const found = world.balls.find((b) => b.id === id)
  if (!found) throw new Error(id)
  return found
}

function zero(b: Ball) {
  b.vx = b.vy = b.vz = 0
  b.wx = b.wy = b.wz = 0
}

export function rackBalls(world: World) {
  const pos = rackPositions()
  for (const b of world.balls) {
    const p = pos[b.id]
    b.x = p.x
    b.z = p.z
    b.y = BED + R
    zero(b)
    b.state = 'live'
  }
  world.firstContact = null
  world.nineLast = null
}

function occupied(world: World, x: number, z: number, ignore: BallId): boolean {
  for (const b of world.balls) {
    if (b.state !== 'live' || b.id === ignore) continue
    if (Math.hypot(b.x - x, b.z - z) < R * 2 + 0.0015) return true
  }
  return false
}

export function placeCue(world: World, x: number, z: number): boolean {
  if (Math.abs(x) > HALF_L - R - 0.006) return false
  if (Math.abs(z) > HALF_W - R - 0.006) return false
  if (occupied(world, x, z, 'cue')) return false
  const cue = ball(world, 'cue')
  cue.x = x
  cue.z = z
  cue.y = BED + R
  zero(cue)
  cue.state = 'live'
  return true
}

export function spotObject(world: World, id: ObjectId) {
  const spots = [
    { x: 0.635, z: 0 },
    { x: 0, z: 0 },
  ]
  for (let i = 1; i <= 16; i++) spots.push({ x: 0.635 - i * R * 2.15, z: 0 })
  const b = ball(world, id)
  for (const s of spots) {
    if (Math.abs(s.x) > HALF_L - R - 0.01) continue
    if (occupied(world, s.x, s.z, id)) continue
    b.x = s.x
    b.z = s.z
    b.y = BED + R
    zero(b)
    b.state = 'live'
    return
  }
}

function applyImpulse(
  b: Ball,
  jx: number,
  jy: number,
  jz: number,
  rx: number,
  ry: number,
  rz: number,
) {
  b.vx += jx / M
  b.vy += jy / M
  b.vz += jz / M
  const tx = ry * jz - rz * jy
  const ty = rz * jx - rx * jz
  const tz = rx * jy - ry * jx
  b.wx += tx / I
  b.wy += ty / I
  b.wz += tz / I
}

export function strike(
  world: World,
  aimX: number,
  aimZ: number,
  power: number,
  hx: number,
  hy: number,
) {
  const cue = ball(world, 'cue')
  const len = Math.hypot(aimX, aimZ) || 1
  const dx = aimX / len
  const dz = aimZ / len
  let ox = hx
  let oy = hy
  const mag = Math.hypot(ox, oy)
  const limit = R * 0.5
  if (mag > limit) {
    ox *= limit / mag
    oy *= limit / mag
  }
  const back = Math.sqrt(Math.max(0, R * R - ox * ox - oy * oy))
  const rx = -dx * back + dz * ox
  const ry = oy
  const rz = -dz * back - dx * ox
  const misc = Math.hypot(ox, oy) / R
  let speed = Math.max(0, Math.min(1, power)) * TUNE.maxCueSpeed
  let pop = 0
  if (misc > 0.42) {
    const k = Math.min(1, (misc - 0.42) / 0.08)
    speed *= 1 - 0.5 * k
    pop = 1.55 * k * Math.max(0.35, power)
  }
  world.firstContact = null
  world.nineLast = null
  applyImpulse(cue, dx * M * speed, 0, dz * M * speed, rx, ry, rz)
  cue.vy += pop
}

function cloth(b: Ball, dt: number) {
  const grounded = b.y <= BED + R + 0.006 && b.vy < 0.45
  if (!grounded) {
    b.vy -= G * dt
    return
  }
  b.y = BED + R
  b.vy = 0
  const sx = b.vx + R * b.wz
  const sz = b.vz - R * b.wx
  const slip = Math.hypot(sx, sz)
  const jMax = TUNE.muSlide * M * G * dt
  const jNeed = (slip * M) / 3.5
  if (slip < 1e-4 || jNeed <= jMax) {
    if (slip > 1e-6) applyImpulse(b, (-sx * M) / 3.5, 0, (-sz * M) / 3.5, 0, -R, 0)
    const sp = Math.hypot(b.vx, b.vz)
    if (sp > 0.004) {
      const dv = Math.min(sp, TUNE.muRoll * G * dt)
      b.vx -= (dv * b.vx) / sp
      b.vz -= (dv * b.vz) / sp
      b.wz = -b.vx / R
      b.wx = b.vz / R
    } else {
      b.vx = b.vz = b.wx = b.wz = 0
    }
  } else {
    applyImpulse(b, (-sx / slip) * jMax, 0, (-sz / slip) * jMax, 0, -R, 0)
  }
  b.wy *= Math.exp(-2.4 * dt)
}

function contactVel(b: Ball, rx: number, ry: number, rz: number) {
  return {
    x: b.vx + (b.wy * rz - b.wz * ry),
    y: b.vy + (b.wz * rx - b.wx * rz),
    z: b.vz + (b.wx * ry - b.wy * rx),
  }
}

function notePair(world: World, a: Ball, b: Ball) {
  const other = (id: BallId) => (id === 'cue' ? (a.id === 'cue' ? b.id : a.id) : null)
  if (a.id === 'cue' || b.id === 'cue') {
    const hit = a.id === 'cue' ? b.id : a.id
    if (world.firstContact === null) world.firstContact = hit
  }
  if (a.id === '9') world.nineLast = b.id
  if (b.id === '9') world.nineLast = a.id
  void other
}

function collideBalls(world: World, a: Ball, b: Ball, events: SimEvent[]) {
  if (a.state !== 'live' || b.state !== 'live') return
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  const d = Math.hypot(dx, dy, dz)
  const min = R * 2
  if (d >= min || d < 1e-8) return
  const nx = dx / d
  const ny = dy / d
  const nz = dz / d
  const rax = nx * R
  const ray = ny * R
  const raz = nz * R
  const va = contactVel(a, rax, ray, raz)
  const vb = contactVel(b, -rax, -ray, -raz)
  const rvx = vb.x - va.x
  const rvy = vb.y - va.y
  const rvz = vb.z - va.z
  const un = rvx * nx + rvy * ny + rvz * nz
  if (un >= -0.004) return
  const jn = -(1 + TUNE.eBall) * un * (M / 2)
  let tx = rvx - un * nx
  let ty = rvy - un * ny
  let tz = rvz - un * nz
  const tmag = Math.hypot(tx, ty, tz)
  let jtx = 0
  let jty = 0
  let jtz = 0
  if (tmag > 1e-5) {
    jtx = (-tx * M) / 7
    jty = (-ty * M) / 7
    jtz = (-tz * M) / 7
    const jm = Math.hypot(jtx, jty, jtz)
    const cap = TUNE.muBall * jn
    if (jm > cap) {
      const s = cap / jm
      jtx *= s
      jty *= s
      jtz *= s
    }
  }
  pending.push(
    { b: a, jx: -nx * jn - jtx, jy: -ny * jn - jty, jz: -nz * jn - jtz, rx: rax, ry: ray, rz: raz },
    { b, jx: nx * jn + jtx, jy: ny * jn + jty, jz: nz * jn + jtz, rx: -rax, ry: -ray, rz: -raz },
  )
  notePair(world, a, b)
  if (-un > 0.12) events.push({ t: 'ball', speed: -un })
}

interface Pending {
  b: Ball
  jx: number
  jy: number
  jz: number
  rx: number
  ry: number
  rz: number
}

const pending: Pending[] = []

function clearsRail(b: Ball) {
  return b.y - R > BED + 0.064
}

function bounce(
  world: World,
  b: Ball,
  nx: number,
  nz: number,
  events: SimEvent[],
) {
  const rx = -nx * R
  const rz = -nz * R
  const vc = contactVel(b, rx, 0, rz)
  const un = vc.x * nx + vc.z * nz
  if (un < -0.01) {
    const jn = -(1 + TUNE.eCush) * un * M
    applyImpulse(b, nx * jn, 0, nz * jn, rx, 0, rz)
    const vc2 = contactVel(b, rx, 0, rz)
    let tx = vc2.x - un * nx
    let ty = vc2.y
    let tz = vc2.z - un * nz
    const tn = tx * nx + tz * nz
    tx -= tn * nx
    tz -= tn * nz
    const tmag = Math.hypot(tx, ty, tz)
    if (tmag > 1e-5) {
      let jtx = (-tx * M) / 3.5
      let jty = b.y <= BED + R + 0.004 ? 0 : (-ty * M) / 3.5
      let jtz = (-tz * M) / 3.5
      const jm = Math.hypot(jtx, jty, jtz)
      const cap = TUNE.muCush * jn
      if (jm > cap) {
        const s = cap / jm
        jtx *= s
        jty *= s
        jtz *= s
      }
      applyImpulse(b, jtx, jty, jtz, rx, 0, rz)
    }
    if (b.id === 'cue' && world.firstContact === null) world.firstContact = 'cushion'
    if (-un > 0.15) events.push({ t: 'cushion', speed: -un })
  }
}

function collideCushions(world: World, b: Ball, events: SimEvent[]) {
  if (b.state !== 'live' || clearsRail(b)) return
  if (captured(b)) return
  for (const s of HW.segs) {
    const abx = s.bx - s.ax
    const abz = s.bz - s.az
    const ab2 = abx * abx + abz * abz
    let t = ((b.x - s.ax) * abx + (b.z - s.az) * abz) / ab2
    t = Math.max(0, Math.min(1, t))
    const cx = s.ax + abx * t
    const cz = s.az + abz * t
    const dx = b.x - cx
    const dz = b.z - cz
    const d = Math.hypot(dx, dz)
    if (d >= R || d < 1e-8) continue
    const nx = dx / d
    const nz = dz / d
    b.x += nx * (R - d)
    b.z += nz * (R - d)
    bounce(world, b, nx, nz, events)
  }
  for (const j of HW.jaws) {
    const dx = b.x - j.x
    const dz = b.z - j.z
    const d = Math.hypot(dx, dz)
    const min = R + 0.011
    if (d >= min || d < 1e-8) continue
    const nx = dx / d
    const nz = dz / d
    b.x += nx * (min - d)
    b.z += nz * (min - d)
    bounce(world, b, nx, nz, events)
  }
}

function captured(b: Ball): PocketHit | null {
  for (const p of HW.pockets) {
    if (Math.hypot(b.x - p.x, b.z - p.z) < p.capture) return p
  }
  return null
}

interface PocketHit {
  x: number
  z: number
  capture: number
}

function pocketsAndOff(_world: World, b: Ball, events: SimEvent[]) {
  if (b.state !== 'live') return
  if (b.y < BED + 0.08 && captured(b)) {
    const speed = Math.hypot(b.vx, b.vy, b.vz)
    b.state = 'pocket'
    b.vx = b.vy = b.vz = 0
    events.push({ t: 'pocket', id: b.id, speed })
    return
  }
  const outside =
    Math.abs(b.x) > HALF_L + 0.015 || Math.abs(b.z) > HALF_W + 0.015
  const far =
    Math.abs(b.x) > HALF_L + RAIL + 0.06 || Math.abs(b.z) > HALF_W + RAIL + 0.06
  if ((outside && clearsRail(b)) || far) {
    b.state = 'off'
    b.vx = b.vy = b.vz = 0
    events.push({ t: 'off', id: b.id })
  }
}

export function step(world: World, dt: number): SimEvent[] {
  const events: SimEvent[] = []
  const live = world.balls.filter((b) => b.state === 'live')
  for (const b of live) cloth(b, dt)
  for (const b of live) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    if (b.y < BED + R) {
      b.y = BED + R
      if (b.vy < 0) b.vy = 0
    }
  }
  for (let k = 0; k < 8; k++) {
    const contacts: { a: Ball; b: Ball; nx: number; ny: number; nz: number; pen: number }[] = []
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]
        const b = live[j]
        if (!a || !b || a.state !== 'live' || b.state !== 'live') continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const d = Math.hypot(dx, dy, dz)
        if (d >= R * 2 || d < 1e-8) continue
        contacts.push({ a, b, nx: dx / d, ny: dy / d, nz: dz / d, pen: R * 2 - d })
      }
    }
    const shift = new Map<Ball, [number, number, number]>()
    for (const c of contacts) {
      if (c.pen < 0.00012) continue
      const push = c.pen * 0.45
      const as = shift.get(c.a) ?? [0, 0, 0]
      const bs = shift.get(c.b) ?? [0, 0, 0]
      as[0] -= c.nx * push
      as[1] -= c.ny * push
      as[2] -= c.nz * push
      bs[0] += c.nx * push
      bs[1] += c.ny * push
      bs[2] += c.nz * push
      shift.set(c.a, as)
      shift.set(c.b, bs)
    }
    for (const [body, s] of shift) {
      body.x += s[0]
      body.y += s[1]
      body.z += s[2]
    }
    pending.length = 0
    for (const c of contacts) collideBalls(world, c.a, c.b, events)
    for (const p of pending) applyImpulse(p.b, p.jx, p.jy, p.jz, p.rx, p.ry, p.rz)
    for (const b of live) collideCushions(world, b, events)
  }
  for (const b of live) pocketsAndOff(world, b, events)
  for (const b of world.balls) {
    if (b.state !== 'live') continue
    const sp = Math.hypot(b.vx, b.vy, b.vz)
    if (sp > 30) {
      const s = 30 / sp
      b.vx *= s
      b.vy *= s
      b.vz *= s
    }
  }
  return events
}

export function allSleeping(world: World): boolean {
  for (const b of world.balls) {
    if (b.state !== 'live') continue
    if (Math.hypot(b.vx, b.vy, b.vz) > 0.012) return false
    if (Math.hypot(b.wx, b.wy, b.wz) > 0.45) return false
  }
  return true
}

export function lowestLive(world: World): ObjectId | null {
  for (const id of ORDER) {
    if (ball(world, id).state === 'live') return id
  }
  return null
}

function distToSeg(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const abx = bx - ax
  const abz = bz - az
  const ab2 = abx * abx + abz * abz || 1
  let t = ((px - ax) * abx + (pz - az) * abz) / ab2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + abx * t
  const cz = az + abz * t
  return Math.hypot(px - cx, pz - cz)
}

function segHit(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
) {
  const rx = bx - ax
  const rz = bz - az
  const sx = dx - cx
  const sz = dz - cz
  const den = rx * sz - rz * sx
  if (Math.abs(den) < 1e-9) return false
  const qpx = cx - ax
  const qpz = cz - az
  const t = (qpx * sz - qpz * sx) / den
  const u = (qpx * rz - qpz * rx) / den
  return t > 0.03 && t < 0.97 && u > 0.03 && u < 0.97
}

export function bothEdgesOpen(world: World): boolean {
  const cue = ball(world, 'cue')
  const id = lowestLive(world)
  if (!id || cue.state !== 'live') return true
  const target = ball(world, id)
  return sideOpen(world, cue, target, 1) && sideOpen(world, cue, target, -1)
}

function sideOpen(world: World, cue: Ball, target: Ball, side: number) {
  const dx = target.x - cue.x
  const dz = target.z - cue.z
  const dist = Math.hypot(dx, dz)
  if (dist < R * 2 + 0.004) return false
  const sinA = Math.min(1, (R * 2) / dist)
  const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA))
  const dirx = dx / dist
  const dirz = dz / dist
  const px = -dirz
  const pz = dirx
  const tx = dirx * cosA + px * side * sinA
  const tz = dirz * cosA + pz * side * sinA
  const L = dist * cosA
  const gx = cue.x + tx * L
  const gz = cue.z + tz * L
  for (const o of world.balls) {
    if (o.state !== 'live' || o.id === cue.id || o.id === target.id) continue
    if (distToSeg(o.x, o.z, cue.x, cue.z, gx, gz) < R * 2 - 0.002) return false
  }
  for (const s of HW.segs) {
    if (segHit(cue.x, cue.z, gx, gz, s.ax, s.az, s.bx, s.bz)) return false
  }
  return true
}

export function measureFullPowerPath(): { meters: number; lengths: number; seconds: number } {
  const world = createWorld()
  for (const b of world.balls) {
    if (b.id !== 'cue') b.state = 'pocket'
  }
  const cue = ball(world, 'cue')
  cue.x = -HALF_L + R + 0.008
  cue.z = 0
  cue.y = BED + R
  zero(cue)
  cue.state = 'live'
  strike(world, 1, 0, 1, 0, 0)
  let dist = 0
  let prevX = cue.x
  let prevZ = cue.z
  const dt = 1 / 1000
  let seconds = 0
  for (let i = 0; i < 40000; i++) {
    step(world, dt)
    dist += Math.hypot(cue.x - prevX, cue.z - prevZ)
    prevX = cue.x
    prevZ = cue.z
    seconds += dt
    if (i > 200 && allSleeping(world)) break
    if (cue.state !== 'live') break
  }
  return { meters: dist, lengths: dist / 2.54, seconds }
}
