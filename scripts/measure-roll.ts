import { allSleeping, ball, createWorld, measureFullPowerPath, step, strike } from '../src/physics.ts'
import { runRuleChecks } from '../src/rules.ts'
import { BED, R, tableHardware } from '../src/spec.ts'

runRuleChecks()
console.log('rules ok')

const measured = measureFullPowerPath()
console.log('path', JSON.stringify(measured))

{
  const world = createWorld()
  for (const b of world.balls) if (b.id !== 'cue') b.state = 'pocket'
  const cue = ball(world, 'cue')
  cue.x = -1.27 + 0.028575 + 0.008
  cue.z = 0
  cue.y = 0.762 + 0.028575
  cue.state = 'live'
  strike(world, 1, 0, 1, 0, 0)
  let dist = 0
  let px = cue.x
  let pz = cue.z
  for (let i = 0; i < 20000; i++) {
    step(world, 0.001)
    dist += Math.hypot(cue.x - px, cue.z - pz)
    px = cue.x
    pz = cue.z
    if (i === 200 || i === 1000 || i === 3000 || i === 8000) {
      console.log(
        't',
        (i / 1000).toFixed(1),
        'v',
        Math.hypot(cue.vx, cue.vz).toFixed(3),
        'x',
        cue.x.toFixed(3),
        'z',
        cue.z.toFixed(3),
        'y',
        cue.y.toFixed(3),
        'w',
        Math.hypot(cue.wx, cue.wy, cue.wz).toFixed(2),
        cue.state,
        'path',
        dist.toFixed(2),
      )
    }
  }
}

function rollTo(x: number, z: number, ax: number, az: number, power: number) {
  const world = createWorld()
  for (const b of world.balls) if (b.id !== 'cue') b.state = 'pocket'
  const cue = ball(world, 'cue')
  cue.x = x
  cue.z = z
  cue.y = BED + R
  cue.state = 'live'
  strike(world, ax, az, power, 0, 0)
  for (let i = 0; i < 8000; i++) {
    step(world, 1 / 1000)
    if (cue.state !== 'live') return `${cue.state} @ ${cue.x.toFixed(3)},${cue.z.toFixed(3)}`
    if (i > 120 && allSleeping(world)) return `stop @ ${cue.x.toFixed(3)},${cue.z.toFixed(3)}`
  }
  return `live @ ${cue.x.toFixed(3)},${cue.z.toFixed(3)}`
}

{
  const w = createWorld()
  strike(w, 1, 0, 0.72, 0, 0)
  for (let i = 0; i < 2500; i++) {
    step(w, 0.001)
    if (i === 350 || i === 700 || i === 1500 || i === 2400) {
      const bits = w.balls.map((b) => `${b.id}:${b.x.toFixed(2)},${b.z.toFixed(2)}`).join(' ')
      console.log('ms', i, bits)
    }
  }
}
console.log('side', rollTo(0, 0, 0, 1, 0.45))
const corner = tableHardware().pockets.find((p) => p.corner)
if (corner) {
  console.log('corner pocket', corner.x.toFixed(3), corner.z.toFixed(3))
  console.log('corner', rollTo(corner.x - 0.35, corner.z - 0.35, 1, 1, 0.4))
}
