/** Locked WPA/BCA 9-foot dimensions, meters, Y-up. */

export const PLAY_L = 2.54
export const PLAY_W = 1.27
export const HALF_L = PLAY_L / 2
export const HALF_W = PLAY_W / 2
export const OUTER_L = 2.9
export const OUTER_W = 1.63
export const RAIL = (OUTER_L - PLAY_L) / 2
export const BALL_D = 0.05715
export const R = BALL_D / 2
export const NOSE_H = 0.0363
export const BED = 0.762
export const SLATE_T = 0.025
export const CORNER_MOUTH = 0.117
export const SIDE_MOUTH = 0.13
export const JAW_R = 0.011
export const CORNER_INSET = CORNER_MOUTH / Math.SQRT2
export const SIDE_HALF = SIDE_MOUTH / 2

export const FOOT_SPOT_X = HALF_L - PLAY_L / 4
export const HEAD_SPOT_X = -FOOT_SPOT_X

export type BallId = 'cue' | '1' | '2' | '3' | '9'
export type ObjectId = '1' | '2' | '3' | '9'
export const ORDER: readonly ObjectId[] = ['1', '2', '3', '9']

export interface Seg {
  ax: number
  az: number
  bx: number
  bz: number
  ox: number
  oz: number
  cornerStart: boolean
  cornerEnd: boolean
}

export interface Jaw {
  x: number
  z: number
}

export interface PocketSpec {
  id: string
  x: number
  z: number
  capture: number
  ox: number
  oz: number
  corner: boolean
}

export function rackPositions(): Record<BallId, { x: number; z: number }> {
  const d = BALL_D
  const x1 = FOOT_SPOT_X
  const x9 = x1 + d
  const mx = x1 + d / 2
  const oz = (d * Math.sqrt(3)) / 2
  return {
    '1': { x: x1, z: 0 },
    '9': { x: x9, z: 0 },
    '2': { x: mx, z: oz },
    '3': { x: mx, z: -oz },
    cue: { x: HEAD_SPOT_X, z: 0 },
  }
}

export function tableHardware(): { segs: Seg[]; jaws: Jaw[]; pockets: PocketSpec[] } {
  const segs: Seg[] = []
  const jaws: Jaw[] = []
  const pockets: PocketSpec[] = []

  // Long rails, nose on z = ±HALF_W. Jaw center is set back from the mouth.
  const northZ = HALF_W
  const southZ = -HALF_W
  segs.push(
    {
      ax: -HALF_L + CORNER_INSET,
      az: northZ,
      bx: -SIDE_HALF,
      bz: northZ,
      ox: 0,
      oz: 1,
      cornerStart: true,
      cornerEnd: false,
    },
    {
      ax: SIDE_HALF,
      az: northZ,
      bx: HALF_L - CORNER_INSET,
      bz: northZ,
      ox: 0,
      oz: 1,
      cornerStart: false,
      cornerEnd: true,
    },
    {
      ax: -HALF_L + CORNER_INSET,
      az: southZ,
      bx: -SIDE_HALF,
      bz: southZ,
      ox: 0,
      oz: -1,
      cornerStart: true,
      cornerEnd: false,
    },
    {
      ax: SIDE_HALF,
      az: southZ,
      bx: HALF_L - CORNER_INSET,
      bz: southZ,
      ox: 0,
      oz: -1,
      cornerStart: false,
      cornerEnd: true,
    },
    {
      ax: HALF_L,
      az: -HALF_W + CORNER_INSET,
      bx: HALF_L,
      bz: HALF_W - CORNER_INSET,
      ox: 1,
      oz: 0,
      cornerStart: true,
      cornerEnd: true,
    },
    {
      ax: -HALF_L,
      az: -HALF_W + CORNER_INSET,
      bx: -HALF_L,
      bz: HALF_W - CORNER_INSET,
      ox: -1,
      oz: 0,
      cornerStart: true,
      cornerEnd: true,
    },
  )

  const addJaw = (tipX: number, tipZ: number, backX: number, backZ: number) => {
    jaws.push({ x: tipX + backX * JAW_R, z: tipZ + backZ * JAW_R })
  }

  // Side mouths along the long rails.
  addJaw(-SIDE_HALF, northZ, -1, 0)
  addJaw(SIDE_HALF, northZ, 1, 0)
  addJaw(-SIDE_HALF, southZ, -1, 0)
  addJaw(SIDE_HALF, southZ, 1, 0)

  // Corner tips: back away from the pocket (toward the rail body).
  const signs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const
  for (const [sx, sz] of signs) {
    const tipLongX = sx * (HALF_L - CORNER_INSET)
    const tipLongZ = sz * HALF_W
    addJaw(tipLongX, tipLongZ, -sx, 0)
    const tipShortX = sx * HALF_L
    const tipShortZ = sz * (HALF_W - CORNER_INSET)
    addJaw(tipShortX, tipShortZ, 0, -sz)

    const midX = (tipLongX + tipShortX) / 2
    const midZ = (tipLongZ + tipShortZ) / 2
    const ox = sx / Math.SQRT2
    const oz = sz / Math.SQRT2
    pockets.push({
      id: `c${sx}${sz}`,
      x: midX + ox * 0.032,
      z: midZ + oz * 0.032,
      capture: 0.034,
      ox,
      oz,
      corner: true,
    })
  }

  pockets.push(
    {
      id: 'n',
      x: 0,
      z: HALF_W + 0.042,
      capture: 0.036,
      ox: 0,
      oz: 1,
      corner: false,
    },
    {
      id: 's',
      x: 0,
      z: -(HALF_W + 0.042),
      capture: 0.036,
      ox: 0,
      oz: -1,
      corner: false,
    },
  )

  return { segs, jaws, pockets }
}

export function diamondMarks(): { x: number; z: number; alongX: boolean }[] {
  const inset = 0.0889
  const marks: { x: number; z: number; alongX: boolean }[] = []
  const stepL = PLAY_L / 8
  for (const i of [1, 2, 3, 5, 6, 7]) {
    const x = -HALF_L + stepL * i
    marks.push({ x, z: HALF_W + inset, alongX: true })
    marks.push({ x, z: -(HALF_W + inset), alongX: true })
  }
  const stepW = PLAY_W / 4
  for (const j of [1, 2, 3]) {
    const z = -HALF_W + stepW * j
    marks.push({ x: HALF_L + inset, z, alongX: false })
    marks.push({ x: -(HALF_L + inset), z, alongX: false })
  }
  return marks
}
