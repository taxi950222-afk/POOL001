import * as THREE from 'three'
import { NOSE_H } from '../spec.ts'
import { createCornerProfile, type ProfilePoint } from './profile.ts'
import { pocketParams, type PocketKind, type PocketParams } from './params.ts'

const ARC_STEPS = 18

type V3 = [number, number, number]

/**
 * Gray-white cowhide shell. Visual only: no collider, no physics.
 * Corner and side do not share a mesh. Corner has no back wall.
 */
export function createPocketMesh(kind: PocketKind, params: PocketParams = pocketParams(kind)): THREE.Group {
  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: '#e4dfd6',
    roughness: 0.62,
    metalness: 0,
    sheen: 0.45,
    sheenColor: new THREE.Color('#f4f1ea'),
    sheenRoughness: 0.45,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  })
  const wireMat = new THREE.MeshBasicMaterial({
    color: '#ddd8ce',
    wireframe: true,
    side: THREE.DoubleSide,
  })

  const jaws = kind === 'corner' ? cornerJaws(params) : sideJaws(params)
  const zAim = jaws.zT + params.depth * 0.35
  const group = new THREE.Group()
  group.name = kind === 'corner' ? 'corner-pocket' : 'side-pocket'

  const add = (name: string, grid: V3[][]) => {
    group.add(meshFromGrid(name, grid, leatherMat, wireMat))
  }

  add('JawL', band(jaws.left, NOSE_H, jaws.left, 0))
  add('JawR', band(jaws.right, NOSE_H, jaws.right, 0))
  const rim = new THREE.Group()
  rim.name = 'MouthRim'
  rim.add(meshFromGrid('MouthRimL', band(jaws.left, NOSE_H, offsetOut(jaws.left, params.jawBevel, zAim), NOSE_H - params.jawBevel), leatherMat, wireMat))
  rim.add(meshFromGrid('MouthRimR', band(jaws.right, NOSE_H, offsetOut(jaws.right, params.jawBevel, zAim), NOSE_H - params.jawBevel), leatherMat, wireMat))
  group.add(rim)
  const shelf = new THREE.Group()
  shelf.name = 'Shelf'
  shelf.add(meshFromGrid('ShelfL', band(jaws.left, 0, offsetInto(jaws.left, params.shelfChamfer, zAim), -params.shelfChamfer), leatherMat, wireMat))
  shelf.add(meshFromGrid('ShelfR', band(jaws.right, 0, offsetInto(jaws.right, params.shelfChamfer, zAim), -params.shelfChamfer), leatherMat, wireMat))
  group.add(shelf)

  const throat = new THREE.Group()
  throat.name = 'Throat'
  const kick = params.drop * Math.tan((params.backTilt * Math.PI) / 180)
  const zBackTop = params.depth
  const zBackBot = params.depth + kick
  const half = params.throatWidth / 2
  throat.add(
    meshFromGrid('ThroatL', wallGrid(-half, jaws.zT, zBackTop, zBackBot, 0, -params.drop, 5, 2), leatherMat, wireMat),
  )
  throat.add(
    meshFromGrid('ThroatR', wallGrid(half, jaws.zT, zBackTop, zBackBot, 0, -params.drop, 5, 2), leatherMat, wireMat),
  )
  group.add(throat)

  const drop = new THREE.Group()
  drop.name = 'Drop'
  drop.add(
    meshFromGrid(
      'Leather',
      netGrid(-half, half, jaws.zT, zBackBot, -params.drop, 0.012, 4, 5),
      leatherMat,
      wireMat,
    ),
  )
  group.add(drop)

  if (kind === 'side') {
    group.add(
      meshFromGrid(
        'Back',
        backGrid(-half, half, zBackTop, zBackBot, 0, -params.drop, 6, 8),
        leatherMat,
        wireMat,
      ),
    )
  }

  return group
}

export function setPocketWireframe(root: THREE.Object3D, enabled: boolean): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const leatherMat = obj.userData.leatherMat as THREE.Material | undefined
    const wireMat = obj.userData.wireMat as THREE.Material | undefined
    if (!leatherMat || !wireMat) return
    obj.material = enabled ? wireMat : leatherMat
  })
}

function cornerJaws(params: PocketParams): { left: ProfilePoint[]; right: ProfilePoint[]; zT: number } {
  const pts = createCornerProfile(params)
  const far = pts.findIndex((p) => p.z === params.depth)
  const left = pts.slice(0, far)
  const right = pts.slice(far + 2)
  return { left, right, zT: left[left.length - 1].z }
}

function sideJaws(params: PocketParams): { left: ProfilePoint[]; right: ProfilePoint[]; zT: number } {
  const mouthHalf = params.mouthWidth / 2
  const throatHalf = params.throatWidth / 2
  const r = params.jawRadius
  const c0x = throatHalf + r
  const zT = r
  const left: ProfilePoint[] = [
    { x: -mouthHalf, z: 0 },
    { x: -c0x, z: 0 },
  ]
  for (let i = 1; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 2 + (i / ARC_STEPS) * (Math.PI / 2)
    left.push({ x: -c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }
  const right: ProfilePoint[] = []
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = Math.PI + (i / ARC_STEPS) * (Math.PI / 2)
    right.push({ x: c0x + r * Math.cos(a), z: zT + r * Math.sin(a) })
  }
  right.push({ x: mouthHalf, z: 0 })
  return { left, right, zT }
}

function offsetInto(points: ProfilePoint[], dist: number, zAim: number): ProfilePoint[] {
  return points.map((p) => shift(p, dist, zAim, 1))
}

function offsetOut(points: ProfilePoint[], dist: number, zAim: number): ProfilePoint[] {
  return points.map((p) => shift(p, dist, zAim, -1))
}

function shift(p: ProfilePoint, dist: number, zAim: number, sign: number): ProfilePoint {
  const dx = -p.x
  const dz = zAim - p.z
  const len = Math.hypot(dx, dz) || 1
  return { x: p.x + (sign * dx * dist) / len, z: p.z + (sign * dz * dist) / len }
}

function band(upper: ProfilePoint[], yUpper: number, lower: ProfilePoint[], yLower: number): V3[][] {
  return [
    upper.map((p) => [p.x, yUpper, p.z]),
    lower.map((p) => [p.x, yLower, p.z]),
  ]
}

function wallGrid(
  x: number,
  zFront: number,
  zBackTop: number,
  zBackBot: number,
  yTop: number,
  yBot: number,
  rows: number,
  cols: number,
): V3[][] {
  const grid: V3[][] = []
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const y = yTop + (yBot - yTop) * t
    const zBack = zBackTop + (zBackBot - zBackTop) * t
    const row: V3[] = []
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      row.push([x, y, zFront + (zBack - zFront) * u])
    }
    grid.push(row)
  }
  return grid
}

function backGrid(
  x0: number,
  x1: number,
  zTop: number,
  zBot: number,
  yTop: number,
  yBot: number,
  rows: number,
  cols: number,
): V3[][] {
  const grid: V3[][] = []
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const y = yTop + (yBot - yTop) * t
    const z = zTop + (zBot - zTop) * t
    const row: V3[] = []
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      row.push([x0 + (x1 - x0) * u, y, z])
    }
    grid.push(row)
  }
  return grid
}

function netGrid(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  sag: number,
  rows: number,
  cols: number,
): V3[][] {
  const grid: V3[][] = []
  for (let r = 0; r <= rows; r++) {
    const v = r / rows
    const row: V3[] = []
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      const edge = u < 1e-8 || u > 1 - 1e-8 || v < 1e-8 || v > 1 - 1e-8
      const fall = edge ? 0 : Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * sag
      row.push([x0 + (x1 - x0) * u, y - fall, z0 + (z1 - z0) * v])
    }
    grid.push(row)
  }
  return grid
}

function meshFromGrid(
  name: string,
  rows: V3[][],
  leatherMat: THREE.Material,
  wireMat: THREE.Material,
): THREE.Mesh {
  const pos: number[] = []
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < rows[r].length - 1; c++) {
      const a = rows[r][c]
      const b = rows[r][c + 1]
      const d = rows[r + 1][c]
      const e = rows[r + 1][c + 1]
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2], e[0], e[1], e[2])
      pos.push(a[0], a[1], a[2], e[0], e[1], e[2], d[0], d[1], d[2])
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, leatherMat)
  mesh.name = name
  mesh.userData.leatherMat = leatherMat
  mesh.userData.wireMat = wireMat
  return mesh
}
