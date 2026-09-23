import * as THREE from 'three'
import type { TableMaterials } from './materials.ts'
import {
  BED,
  CORNER_INSET,
  HALF_L,
  HALF_W,
  PLAY_L,
  PLAY_W,
  RAIL,
  SIDE_HALF,
  SLATE_T,
  diamondMarks,
} from './spec.ts'

const WOOD_BOTTOM = -0.028
const WOOD_TOP = 0.064

function addBox(
  group: THREE.Group,
  mat: THREE.Material,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
) {
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  const d = Math.abs(z1 - z0)
  if (w < 1e-6 || h < 1e-6 || d < 1e-6) return
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
}

function shadeGeometry() {
  const topW = 0.26
  const topD = 0.16
  const botW = 0.4
  const botD = 0.26
  const h = 0.15
  const pts = [
    [-topW / 2, h, -topD / 2],
    [topW / 2, h, -topD / 2],
    [topW / 2, h, topD / 2],
    [-topW / 2, h, topD / 2],
    [-botW / 2, 0, -botD / 2],
    [botW / 2, 0, -botD / 2],
    [botW / 2, 0, botD / 2],
    [-botW / 2, 0, botD / 2],
  ]
  const faces = [
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
    [0, 1, 2, 3],
  ]
  const positions: number[] = []
  for (const f of faces) {
    const a = pts[f[0] ?? 0]
    const b = pts[f[1] ?? 0]
    const c = pts[f[2] ?? 0]
    const d = pts[f[3] ?? 0]
    if (!a || !b || !c || !d) continue
    positions.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

function diamondGeometry(alongX: boolean) {
  const L = 0.008
  const W = 0.0042
  const h = 0.0011
  const shape = new THREE.Shape()
  if (alongX) {
    shape.moveTo(0, W)
    shape.lineTo(L, 0)
    shape.lineTo(0, -W)
    shape.lineTo(-L, 0)
  } else {
    shape.moveTo(W, 0)
    shape.lineTo(0, L)
    shape.lineTo(-W, 0)
    shape.lineTo(0, -L)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, h, 0)
  return geo
}

function bedShape() {
  const shape = new THREE.Shape()
  const xl = HALF_L - CORNER_INSET
  const xh = HALF_L
  const zw = HALF_W
  const zc = HALF_W - CORNER_INSET
  shape.moveTo(-xl, -zw)
  shape.lineTo(xl, -zw)
  shape.lineTo(xh, -zc)
  shape.lineTo(xh, zc)
  shape.lineTo(xl, zw)
  shape.lineTo(-xl, zw)
  shape.lineTo(-xh, zc)
  shape.lineTo(-xh, -zc)
  shape.closePath()
  return shape
}

export function buildTable(mats: TableMaterials) {
  const root = new THREE.Group()
  const clothT = 0.0015
  const felt = new THREE.Mesh(new THREE.ExtrudeGeometry(bedShape(), { depth: clothT, bevelEnabled: false }), mats.cloth)
  felt.rotation.x = -Math.PI / 2
  felt.position.y = BED - clothT
  felt.receiveShadow = true
  root.add(felt)

  const slateGap = 0.0008
  const slateL = PLAY_L - 0.04
  const slateW = PLAY_W - 0.04
  const piece = (slateL - slateGap * 2) / 3
  const slateTop = BED - clothT - 0.0025
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece, SLATE_T, slateW), mats.slate)
    mesh.position.set(-slateL / 2 + piece / 2 + i * (piece + slateGap), slateTop - SLATE_T / 2, 0)
    mesh.receiveShadow = true
    root.add(mesh)
  }

  const seamMat = new THREE.MeshBasicMaterial({ color: '#06140c', transparent: true, opacity: 0.28 })
  for (const x of [-slateL / 6, slateL / 6]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0002, PLAY_W - 0.12), seamMat)
    seam.position.set(x, BED + 0.00012, 0)
    root.add(seam)
  }
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(0.004, 20),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.14 }),
  )
  spot.rotation.x = -Math.PI / 2
  spot.position.set(HALF_L - PLAY_L / 4, BED + 0.0002, 0)
  root.add(spot)

  const y0 = BED + WOOD_BOTTOM
  const y1 = BED + WOOD_TOP
  const outerX = HALF_L + RAIL
  const outerZ = HALF_W + RAIL
  const rub = 0.016
  const shell = 0.07
  const sideGap = 0.08
  const apronT = 0.04
  const apronH = 0.16
  const apronTop = y0 + 0.001
  const apronBottom = apronTop - apronH
  const cornerX = HALF_L - CORNER_INSET
  const cornerZ = HALF_W - CORNER_INSET
  const cushY0 = BED + 0.002
  const cushY1 = BED + 0.038

  for (const sz of [1, -1] as const) {
    const zShell0 = sz * (outerZ - shell)
    const zShell1 = sz * outerZ
    const zInner0 = sz * (HALF_W + rub - 0.001)
    const zInner1 = sz * (outerZ - shell + 0.001)
    addBox(root, mats.oak, -outerX, -sideGap, y0, y1, zShell0, zShell1)
    addBox(root, mats.oak, sideGap, outerX, y0, y1, zShell0, zShell1)
    addBox(root, mats.oak, -outerX, -sideGap, y0, y1, zInner0, zInner1)
    addBox(root, mats.oak, sideGap, outerX, y0, y1, zInner0, zInner1)
    addBox(root, mats.oak, -sideGap - 0.004, sideGap + 0.004, BED + 0.044, y1, zInner0, zShell1)
    addBox(
      root,
      mats.leather,
      -sideGap - 0.001,
      sideGap + 0.001,
      apronBottom - 0.13,
      BED + 0.046,
      sz * (HALF_W + rub - 0.002),
      sz * (outerZ - 0.001),
    )
    addBox(root, mats.cloth, -(cornerX - 0.002), -(SIDE_HALF - 0.01), cushY0, cushY1, sz * HALF_W, sz * (HALF_W + rub + 0.001))
    addBox(root, mats.cloth, SIDE_HALF - 0.01, cornerX - 0.002, cushY0, cushY1, sz * HALF_W, sz * (HALF_W + rub + 0.001))
    addBox(root, mats.oak, -(cornerX - 0.002), -sideGap, BED + 0.034, y1, sz * (HALF_W + 0.002), zInner0)
    addBox(root, mats.oak, sideGap, cornerX - 0.002, BED + 0.034, y1, sz * (HALF_W + 0.002), zInner0)
    const zApron0 = sz * (outerZ - apronT)
    const zApron1 = sz * outerZ
    addBox(root, mats.oak, -outerX, -sideGap, apronBottom, apronTop, zApron0, zApron1)
    addBox(root, mats.oak, sideGap, outerX, apronBottom, apronTop, zApron0, zApron1)
  }

  for (const sx of [1, -1] as const) {
    const xShell0 = sx * (outerX - shell)
    const xShell1 = sx * outerX
    addBox(root, mats.oak, xShell0, xShell1, y0, y1, -(outerZ - shell - 0.004), outerZ - shell - 0.004)
    const xInner0 = sx * (HALF_L + rub - 0.001)
    const xInner1 = sx * (outerX - shell + 0.001)
    addBox(root, mats.oak, xInner0, xInner1, y0, y1, -cornerZ, cornerZ)
    addBox(root, mats.cloth, sx * HALF_L, sx * (HALF_L + rub + 0.001), cushY0, cushY1, -(cornerZ - 0.002), cornerZ - 0.002)
    addBox(root, mats.oak, sx * (HALF_L + 0.002), xInner0, BED + 0.034, y1, -(cornerZ - 0.002), cornerZ - 0.002)
    const xApron0 = sx * (outerX - apronT)
    const xApron1 = sx * outerX
    addBox(root, mats.oak, xApron0, xApron1, apronBottom, apronTop, -(outerZ - apronT - 0.001), outerZ - apronT - 0.001)
  }

  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      addBox(
        root,
        mats.leather,
        sx * 1.292,
        sx * 1.382,
        apronBottom - 0.14,
        BED + 0.03,
        sz * 0.55,
        sz * 0.648,
      )
      addBox(root, mats.oak, sx * 1.288, sx * 1.384, BED + 0.042, y1, sz * 0.546, sz * 0.652)
    }
  }

  const legTop = apronBottom
  const footH = 0.04
  const legGeo = new THREE.CylinderGeometry(0.045, 0.055, legTop - footH, 4)
  legGeo.rotateY(Math.PI / 4)
  legGeo.translate(0, (legTop - footH) / 2 + footH, 0)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, mats.oak)
      leg.position.set(sx * 1.16, 0, sz * 0.55)
      leg.castShadow = true
      leg.receiveShadow = true
      root.add(leg)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, footH, 0.13), mats.oak)
      foot.position.set(sx * 1.16, footH / 2, sz * 0.55)
      foot.castShadow = true
      root.add(foot)
    }
  }

  for (const mark of diamondMarks()) {
    const d = new THREE.Mesh(diamondGeometry(mark.alongX), mats.pearl)
    d.position.set(mark.x, BED + WOOD_TOP - 0.0011, mark.z)
    root.add(d)
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mats.floor)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  root.add(floor)

  const lamp = buildLamp(mats)
  root.add(lamp.group)
  return { root, lights: lamp.lights, bulbs: lamp.bulbs }
}

function buildLamp(mats: TableMaterials) {
  const group = new THREE.Group()
  const shadeGeo = shadeGeometry()
  const xs = [-0.48, 0, 0.48]
  const y = BED + 0.72
  const lights: THREE.SpotLight[] = []
  const bulbs: THREE.MeshStandardMaterial[] = []
  for (const x of xs) {
    const outer = new THREE.Mesh(shadeGeo, mats.lampShade)
    outer.position.set(x, y, 0)
    outer.castShadow = false
    const inner = new THREE.Mesh(shadeGeo, mats.lampInside)
    inner.position.copy(outer.position)
    inner.scale.setScalar(0.92)
    group.add(outer, inner)
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#ffd7a4',
      emissive: '#ffb15a',
      emissiveIntensity: 0.1125,
      roughness: 0.4,
    })
    bulbs.push(bulbMat)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), bulbMat)
    bulb.position.set(x, y + 0.05, 0)
    group.add(bulb)
    const spot = new THREE.SpotLight('#ffc48a', 1.75, 5.5, 0.68, 0.62, 1)
    spot.position.set(x, y + 0.02, 0)
    spot.target.position.set(x * 0.3, BED, 0)
    spot.castShadow = true
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.bias = -0.0004
    spot.shadow.normalBias = 0.03
    spot.shadow.camera.near = 0.2
    spot.shadow.camera.far = 4.5
    group.add(spot, spot.target)
    lights.push(spot)
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.025, 0.025), mats.brass)
  bar.position.set(0, y + 0.17, 0)
  group.add(bar)
  for (const x of [-0.42, 0.42]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.72, 6), mats.brass)
    chain.position.set(x, y + 0.17 + 0.36, 0)
    group.add(chain)
  }
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), mats.brass)
  rose.position.set(0, y + 0.17 + 0.72, 0)
  group.add(rose)
  return { group, lights, bulbs }
}

export function buildCue() {
  const group = new THREE.Group()
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.011, 1.15, 10),
    new THREE.MeshStandardMaterial({ color: '#d7b07a', roughness: 0.45 }),
  )
  shaft.rotation.z = Math.PI / 2
  shaft.position.x = -0.62
  const butt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, 0.28, 10),
    new THREE.MeshStandardMaterial({ color: '#5a3018', roughness: 0.5 }),
  )
  butt.rotation.z = Math.PI / 2
  butt.position.x = -1.28
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.006, 0.025, 8),
    new THREE.MeshStandardMaterial({ color: '#2f6df0', roughness: 0.4 }),
  )
  tip.rotation.z = Math.PI / 2
  tip.position.x = -0.03
  group.add(shaft, butt, tip)
  group.rotation.order = 'YXZ'
  return group
}
