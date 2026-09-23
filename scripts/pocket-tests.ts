import { mountAxes, pocketMounts } from '../src/pocket/params.ts'
import { ccdPlan, localOf, pocketDebug } from '../src/pocket/colliders.ts'
import { ball, createWorld, step } from '../src/physics.ts'
import { BED, R } from '../src/spec.ts'

const DT = 1 / 600
const corner = pocketMounts().find((m) => m.id === 'ne')
const north = pocketMounts().find((m) => m.id === 'n')
if (!corner || !north) throw new Error('mount')

function place(
  lx: number,
  ly: number,
  lz: number,
  lvx: number,
  lvy: number,
  lvz: number,
  mount = corner!,
) {
  const world = createWorld()
  for (const b of world.balls) {
    if (b.id !== 'cue') b.state = 'off'
  }
  const cue = ball(world, 'cue')
  const a = mountAxes(mount)
  cue.x = mount.x + lx * a.xx + lz * a.zx
  cue.y = mount.y + ly
  cue.z = mount.z + lx * a.xz + lz * a.zz
  cue.vx = lvx * a.xx + lvz * a.zx
  cue.vy = lvy
  cue.vz = lvx * a.xz + lvz * a.zz
  cue.wx = cue.vz / R
  cue.wy = 0
  cue.wz = -cue.vx / R
  cue.state = 'live'
  return { world, cue }
}

function jawGap(mount: typeof corner, x: number, y: number, z: number) {
  const L = localOf(mount!, x, y, z)
  const c0x = mount!.kind === 'corner' ? 0.045 + 0.01 : 0.0475 + 0.012
  const zT = mount!.kind === 'corner' ? 0.057 - c0x + 0.01 * Math.SQRT2 : 0.012
  const r = mount!.kind === 'corner' ? 0.01 : 0.012
  const d = Math.min(Math.hypot(L.x - c0x, L.z - zT), Math.hypot(L.x + c0x, L.z - zT))
  return d - (R + r)
}

const lines: string[] = []
function report(name: string, ok: boolean, detail: string) {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

function runLocal(
  name: string,
  lx: number,
  lz: number,
  lvx: number,
  lvz: number,
  seconds: number,
  mount = corner!,
) {
  const { world, cue } = place(lx, R, lz, lvx, 0, lvz, mount)
  let pocketed = false
  let minY = cue.y
  let minGap = Infinity
  let sep = -1
  let blocked = false
  let maxStep = 0
  const zCap = mount.kind === 'corner' ? 0.0161 : 0.012
  let prevZ = localOf(mount, cue.x, cue.y, cue.z).z
  const steps = Math.round(seconds / DT)
  for (let i = 0; i < steps; i++) {
    const beforeX = cue.x
    const beforeZ = cue.z
    const events = step(world, DT)
    if (events.some((e) => e.t === 'pocket')) pocketed = true
    if (cue.y < minY) minY = cue.y
    const gap = jawGap(mount, cue.x, cue.y, cue.z)
    if (i > 8 && gap < minGap) minGap = gap
    const L = localOf(mount, cue.x, cue.y, cue.z)
    const moved = Math.hypot(cue.x - beforeX, cue.z - beforeZ)
    if (moved > maxStep) maxStep = moved
    if (gap < 0.004) blocked = true
    if (blocked && gap >= -0.001 && sep < 0 && L.z < prevZ) sep = Math.hypot(cue.vx, cue.vy, cue.vz)
    prevZ = L.z
    if (pocketed) break
  }
  const L = localOf(mount, cue.x, cue.y, cue.z)
  return { cue, pocketed, minY, minGap, sep, maxStep, L, state: cue.state }
}

{
  const plan = ccdPlan(8, DT)
  const hit = runLocal('正对 2 m/s', 0, -0.2, 0, 2, 2)
  report('正对 2 m/s', hit.pocketed && hit.state === 'pocket', `state=${hit.state} z=${hit.L.z.toFixed(3)}`)
  const slow = runLocal('偏移 0.2R 0.5 m/s', 0.005715, -0.2, 0, 0.5, 3)
  report('偏移 0.2R 0.5 m/s', slow.pocketed && slow.state === 'pocket', `state=${slow.state} z=${slow.L.z.toFixed(3)}`)
  const mid = runLocal('偏移 0.4R 2 m/s', 0.01143, -0.2, 0, 2, 2)
  report('偏移 0.4R 2 m/s', mid.pocketed && mid.state === 'pocket', `state=${mid.state} z=${mid.L.z.toFixed(3)} y=${mid.L.y.toFixed(3)}`)
  const graze = runLocal('偏移 0.7R 25° 2 m/s', -0.07326, -0.2, 0.8452, 1.8126, 1.5)
  const grazeOk =
    !graze.pocketed &&
    graze.state === 'live' &&
    graze.L.z < 0.0161 &&
    graze.sep > 0 &&
    graze.sep <= 0.85 * 2 &&
    graze.minGap > -0.002
  report(
    '偏移 0.7R 25° 2 m/s',
    grazeOk,
    `state=${graze.state} z=${graze.L.z.toFixed(4)} sep=${graze.sep.toFixed(3)} gap=${graze.minGap.toFixed(4)}`,
  )
  const wide = runLocal('偏移 1.0R 0° 2 m/s', 0.028575, -0.2, 0, 2, 1.5)
  const wideOk = !wide.pocketed && wide.state === 'live' && wide.minGap > -0.002 && wide.L.z < 0.05
  report(
    '偏移 1.0R 0° 2 m/s',
    wideOk,
    `state=${wide.state} z=${wide.L.z.toFixed(4)} gap=${wide.minGap.toFixed(4)} speed=${Math.hypot(wide.cue.vx, wide.cue.vy, wide.cue.vz).toFixed(3)}`,
  )
  const rail = runLocal('北中袋沿库 30° 4 m/s', -0.088575, -0.5 * R, 3.464102, 2, 1.2, north)
  const railSpeed = Math.hypot(rail.cue.vx, rail.cue.vy, rail.cue.vz)
  const railOk =
    rail.minGap > -0.003 &&
    (rail.state === 'live' || rail.state === 'pocket') &&
    (railSpeed > 0.05 || rail.minGap > 0)
  report(
    '北中袋沿库 30° 4 m/s',
    railOk,
    `state=${rail.state} gap=${rail.minGap.toFixed(4)} maxStep=${rail.maxStep.toFixed(4)} z=${rail.L.z.toFixed(3)}`,
  )
  const fast = runLocal('正对 8 m/s', 0, -0.2, 0, 8, 2)
  const ccdOk = plan.n === 3 && !plan.overflow && plan.maxSubsteps === 8
  const floorOk = fast.minY >= BED - 0.09 - 0.004
  report(
    '正对 8 m/s',
    fast.pocketed && fast.state === 'pocket' && ccdOk && floorOk,
    `state=${fast.state} minY=${fast.minY.toFixed(4)} segments=${plan.n} overflow=${plan.overflow}`,
  )

  const { world, cue } = place(0, R, -0.2, 0, 0, 8)
  let age = -1
  let rested = false
  let minY = cue.y
  for (let i = 0; i < 5 * 600; i++) {
    step(world, DT)
    if (cue.y < minY) minY = cue.y
    const dbg = pocketDebug(cue)
    if (dbg) {
      age = dbg.age
      rested = dbg.rested
      if (rested || dbg.age >= 3) break
    }
  }
  const dbg = pocketDebug(cue)
  const restOk = cue.state === 'pocket' && !!dbg && dbg.rested && dbg.age <= 3.05 && Math.hypot(cue.vx, cue.vy, cue.vz) < 0.02
  report(
    '落下后 3 s',
    restOk && minY >= BED - 0.09 - 0.004,
    `rested=${dbg?.rested} age=${age.toFixed(3)} slow=${dbg?.slow.toFixed(3)} y=${cue.y.toFixed(3)}`,
  )
}

console.log(lines.join('\n'))
if (lines.some((l) => l.startsWith('FAIL'))) process.exit(1)
