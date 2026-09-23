import { BED, CORNER_INSET, HALF_L, HALF_W } from '../spec.ts'

export type PocketKind = 'corner' | 'side'
export type PocketId = 'ne' | 'se' | 'sw' | 'nw' | 'n' | 's'

/** Throat entrance, local z of fillet point T, meters, rounded to 0.1 mm. */
export const CORNER_Z_CAPTURE = 0.0161
export const SIDE_Z_CAPTURE = 0.012

export interface PocketParams {
  mouthWidth: number
  throatWidth: number
  depth: number
  jawRadius: number
  shelfChamfer: number
  jawBevel: number
  drop: number
  /** Degrees from vertical. Corner has no back wall. */
  backTilt: number
  rubberThickness: number
  /** Local z of point T, meters. Not depth/2. */
  zCapture: number
}

/**
 * Corner T: nose line x + z = mouthWidth/2 is 45° from +z.
 * C0 = (throatWidth/2 + jawRadius, zT) = (0.055, zT), radius 0.010.
 * |0.055 + zT − 0.057| / √2 = 0.010 → zT = 0.002 + 0.010√2 = 0.016142… → 0.0161 m.
 */
export const CORNER_PARAMS: PocketParams = {
  mouthWidth: 0.114,
  throatWidth: 0.09,
  depth: 0.12,
  jawRadius: 0.01,
  shelfChamfer: 0.005,
  jawBevel: 0.008,
  drop: 0.09,
  backTilt: 0,
  rubberThickness: 0.016,
  zCapture: CORNER_Z_CAPTURE,
}

/**
 * Side T: nose line z = 0 (parallel to +x) tangent to the circle,
 * and the circle tangent to x = ±throatWidth/2.
 * zT = jawRadius = 0.0120 m. Nose tangent |x| = 0.0595, mouthWidth stays 0.120.
 */
export const SIDE_PARAMS: PocketParams = {
  mouthWidth: 0.12,
  throatWidth: 0.095,
  depth: 0.11,
  jawRadius: 0.012,
  shelfChamfer: 0.006,
  jawBevel: 0.008,
  drop: 0.09,
  backTilt: 12,
  rubberThickness: 0.016,
  zCapture: SIDE_Z_CAPTURE,
}

export function pocketParams(kind: PocketKind): PocketParams {
  return kind === 'corner' ? CORNER_PARAMS : SIDE_PARAMS
}

export interface PocketMount {
  id: PocketId
  kind: PocketKind
  legacyId: string
  x: number
  y: number
  z: number
  /** Radians. Local +z maps to world (sin yaw, 0, cos yaw). */
  yaw: number
}

export function mountAxes(mount: PocketMount): {
  zx: number
  zz: number
  xx: number
  xz: number
} {
  const zx = Math.sin(mount.yaw)
  const zz = Math.cos(mount.yaw)
  return { zx, zz, xx: zz, xz: -zx }
}

function cornerMount(id: PocketId, legacyId: string, sx: number, sz: number): PocketMount {
  return {
    id,
    kind: 'corner',
    legacyId,
    x: sx * (HALF_L - CORNER_INSET / 2),
    y: BED,
    z: sz * (HALF_W - CORNER_INSET / 2),
    yaw: Math.atan2(sx / Math.SQRT2, sz / Math.SQRT2),
  }
}

/** Six mounts. Origins come from spec.ts constants, not from the old capture circles. */
export function pocketMounts(): PocketMount[] {
  return [
    cornerMount('ne', 'c11', 1, 1),
    cornerMount('se', 'c1-1', 1, -1),
    cornerMount('sw', 'c-1-1', -1, -1),
    cornerMount('nw', 'c-11', -1, 1),
    {
      id: 'n',
      kind: 'side',
      legacyId: 'n',
      x: 0,
      y: BED,
      z: HALF_W,
      yaw: Math.atan2(0, 1),
    },
    {
      id: 's',
      kind: 'side',
      legacyId: 's',
      x: 0,
      y: BED,
      z: -HALF_W,
      yaw: Math.atan2(0, -1),
    },
  ]
}
