import { mountAxes, pocketMounts, pocketParams } from '../src/pocket/params.ts'
import { BED, CORNER_INSET, HALF_L, HALF_W, R, tableHardware } from '../src/spec.ts'

const doc = [
  { id: 'ne', kind: 'corner', legacyId: 'c11', x: 1.228634, y: 0.762, z: 0.593634, yawDeg: 45 },
  { id: 'se', kind: 'corner', legacyId: 'c1-1', x: 1.228634, y: 0.762, z: -0.593634, yawDeg: 135 },
  { id: 'sw', kind: 'corner', legacyId: 'c-1-1', x: -1.228634, y: 0.762, z: -0.593634, yawDeg: -135 },
  { id: 'nw', kind: 'corner', legacyId: 'c-11', x: -1.228634, y: 0.762, z: 0.593634, yawDeg: -45 },
  { id: 'n', kind: 'side', legacyId: 'n', x: 0, y: 0.762, z: 0.635, yawDeg: 0 },
  { id: 's', kind: 'side', legacyId: 's', x: 0, y: 0.762, z: -0.635, yawDeg: 180 },
] as const

const legacy = new Set(tableHardware().pockets.map((p) => p.id))
const mounts = pocketMounts()
let match = true

const corner = pocketParams('corner')
const side = pocketParams('side')
console.log(`zCapture corner ${corner.zCapture.toFixed(4)} m`)
console.log(`zCapture side   ${side.zCapture.toFixed(4)} m`)

for (let i = 0; i < mounts.length; i++) {
  const m = mounts[i]
  const row = doc[i]
  if (!m || !row) {
    match = false
    continue
  }
  const yawDeg = (m.yaw * 180) / Math.PI
  const axes = mountAxes(m)
  const dx = m.x - row.x
  const dy = m.y - row.y
  const dz = m.z - row.z
  const dyaw = yawDeg - row.yawDeg
  const poseOk = Math.abs(dx) < 5e-7 && Math.abs(dy) < 5e-7 && Math.abs(dz) < 5e-7 && Math.abs(dyaw) < 1e-6
  const idOk = m.id === row.id && m.kind === row.kind && m.legacyId === row.legacyId && legacy.has(m.legacyId)
  const fromSpec =
    m.kind === 'corner'
      ? Math.abs(Math.abs(m.x) - (HALF_L - CORNER_INSET / 2)) < 1e-12 &&
        Math.abs(Math.abs(m.z) - (HALF_W - CORNER_INSET / 2)) < 1e-12 &&
        m.y === BED
      : m.x === 0 && m.y === BED && Math.abs(Math.abs(m.z) - HALF_W) < 1e-12
  const ok = poseOk && idOk && fromSpec
  if (!ok) match = false
  console.log(
    [
      m.id,
      m.kind,
      `legacy=${m.legacyId}`,
      `world=(${m.x.toFixed(9)}, ${m.y.toFixed(9)}, ${m.z.toFixed(9)})`,
      `yaw=${yawDeg.toFixed(6)}`,
      `+z=(${axes.zx.toFixed(6)}, ${axes.zz.toFixed(6)})`,
      `+x=(${axes.xx.toFixed(6)}, ${axes.xz.toFixed(6)})`,
      ok ? 'MATCH' : 'MISMATCH',
    ].join(' '),
  )
}

const north = mounts.find((m) => m.id === 'n')
if (north) {
  const axes = mountAxes(north)
  const lx = -(side.mouthWidth / 2 + R)
  const lz = -0.5 * R
  const wx = north.x + lx * axes.xx + lz * axes.zx
  const wy = north.y + R
  const wz = north.z + lx * axes.xz + lz * axes.zz
  console.log(
    `along-rail world (${wx.toFixed(7)}, ${wy.toFixed(7)}, ${wz.toFixed(7)}) expect (-0.0885750, 0.7905750, 0.6207125)`,
  )
}

console.log(match ? 'mounts match spec.ts and the doc table' : 'MOUNT MISMATCH')
if (!match) process.exit(1)
