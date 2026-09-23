import { CORNER_PARAMS, type PocketParams } from './params.ts'

export interface ProfilePoint {
  x: number
  z: number
}

const ARC_STEPS = 18

/**
 * Corner mouth outline in local xz, clockwise from the left lip, +z into the pocket.
 * Jaw fillet is the circle of jawRadius tangent to the 45° nose and to x = ±throatWidth/2.
 * After point T the walls are parallel to +z. Side pockets are not built here.
 * T is the exact tangency (about 0.016142 m). The published capture plane stays the rounded zCapture.
 */
export function createCornerProfile(params: PocketParams = CORNER_PARAMS): ProfilePoint[] {
  const mouthHalf = params.mouthWidth / 2
  const throatHalf = params.throatWidth / 2
  const r = params.jawRadius
  const c0x = throatHalf + r
  const zT = mouthHalf - c0x + r * Math.SQRT2
  const n = Math.SQRT1_2
  const c1x = c0x - r * n
  const c1z = zT - r * n
  const points: ProfilePoint[] = [{ x: -mouthHalf, z: 0 }, { x: -c1x, z: c1z }]

  for (let i = 1; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 4 + (i / ARC_STEPS) * (Math.PI / 4)
    points.push({ x: -c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }

  points.push({ x: -throatHalf, z: params.depth })
  points.push({ x: throatHalf, z: params.depth })

  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = Math.PI + (i / ARC_STEPS) * (Math.PI / 4)
    points.push({ x: c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }

  points.push({ x: mouthHalf, z: 0 })
  return points
}
