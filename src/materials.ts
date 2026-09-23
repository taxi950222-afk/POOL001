import * as THREE from 'three'

function canvasTex(c: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  t.anisotropy = 8
  return t
}

function clothMaps() {
  const s = 256
  const albedo = document.createElement('canvas')
  albedo.width = albedo.height = s
  const normal = document.createElement('canvas')
  normal.width = normal.height = s
  const ga = albedo.getContext('2d')
  const gn = normal.getContext('2d')
  if (!ga || !gn) throw new Error('canvas')
  const ia = ga.createImageData(s, s)
  const inrm = gn.createImageData(s, s)
  const threads = 48
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const fx = (x * threads) / s
      const fy = (y * threads) / s
      const warp = Math.cos((fy % 1) * Math.PI * 2)
      const weft = Math.cos((fx % 1) * Math.PI * 2)
      const weave = warp * 0.5 + weft * 0.5
      const shade = 228 + weave * 18
      const i = (y * s + x) * 4
      ia.data[i] = shade
      ia.data[i + 1] = shade
      ia.data[i + 2] = shade
      ia.data[i + 3] = 255
      const nx = weft * 0.35
      const ny = warp * 0.35
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      inrm.data[i] = (nx / len) * 127 + 128
      inrm.data[i + 1] = (ny / len) * 127 + 128
      inrm.data[i + 2] = (nz / len) * 127 + 128
      inrm.data[i + 3] = 255
    }
  }
  ga.putImageData(ia, 0, 0)
  gn.putImageData(inrm, 0, 0)
  const map = canvasTex(albedo, 10, 5)
  const nmap = new THREE.CanvasTexture(normal)
  nmap.wrapS = THREE.RepeatWrapping
  nmap.wrapT = THREE.RepeatWrapping
  nmap.repeat.set(10, 5)
  return { map, nmap }
}

function oakMap() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.fillStyle = '#e6d3b2'
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < 110; i++) {
    const y = (i / 110) * s + (Math.random() - 0.5) * 4
    const alpha = 0.04 + (i % 7 === 0 ? 0.16 : 0.06)
    g.strokeStyle = `rgba(92, 68, 38, ${alpha})`
    g.lineWidth = i % 5 === 0 ? 2.2 : 1
    g.beginPath()
    let yy = y
    g.moveTo(0, yy)
    for (let x = 0; x <= s; x += 16) {
      yy += (Math.random() - 0.5) * 5
      g.lineTo(x, yy)
    }
    g.stroke()
  }
  for (let i = 0; i < 55; i++) {
    g.fillStyle = `rgba(255, 246, 226, ${0.18 + Math.random() * 0.45})`
    const w = 10 + Math.random() * 46
    const h = 1.5 + Math.random() * 3.5
    g.fillRect(Math.random() * s, Math.random() * s, w, h)
  }
  return canvasTex(c, 2, 1)
}

function leatherMap() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.fillStyle = '#ddd8ce'
  g.fillRect(0, 0, s, s)
  for (let i = 0; i < 1400; i++) {
    const v = 170 + Math.random() * 70
    g.fillStyle = `rgba(${v}, ${v - 4}, ${v - 8}, 0.28)`
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2)
  }
  for (let i = 0; i < 18; i++) {
    g.strokeStyle = `rgba(90, 86, 78, ${0.08 + Math.random() * 0.1})`
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(Math.random() * s, Math.random() * s)
    g.bezierCurveTo(
      Math.random() * s,
      Math.random() * s,
      Math.random() * s,
      Math.random() * s,
      Math.random() * s,
      Math.random() * s,
    )
    g.stroke()
  }
  return canvasTex(c, 1, 1)
}

function floorMap() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.fillStyle = '#16120e'
  g.fillRect(0, 0, s, s)
  const plank = 64
  for (let y = 0; y < s; y += plank) {
    const shade = 18 + Math.random() * 14
    g.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 6})`
    g.fillRect(0, y, s, plank - 2)
    g.strokeStyle = 'rgba(0,0,0,0.45)'
    g.strokeRect(0, y, s, plank - 2)
  }
  return canvasTex(c, 6, 6)
}

export interface TableMaterials {
  cloth: THREE.MeshPhysicalMaterial
  oak: THREE.MeshPhysicalMaterial
  leather: THREE.MeshPhysicalMaterial
  metal: THREE.MeshStandardMaterial
  pearl: THREE.MeshPhysicalMaterial
  slate: THREE.MeshStandardMaterial
  floor: THREE.MeshStandardMaterial
  lampShade: THREE.MeshStandardMaterial
  lampInside: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
}

export function createMaterials(): TableMaterials {
  const clothTex = clothMaps()
  const oak = oakMap()
  const leather = leatherMap()
  const floor = floorMap()
  const cloth = new THREE.MeshPhysicalMaterial({
    color: '#127a3e',
    map: clothTex.map,
    normalMap: clothTex.nmap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.84,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color('#7dcea0'),
    sheenRoughness: 0.6,
  })
  return {
    cloth,
    oak: new THREE.MeshPhysicalMaterial({
      map: oak,
      roughness: 0.48,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
    }),
    leather: new THREE.MeshPhysicalMaterial({
      map: leather,
      color: '#e4dfd6',
      roughness: 0.62,
      metalness: 0,
      sheen: 0.45,
      sheenColor: new THREE.Color('#f4f1ea'),
      sheenRoughness: 0.45,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: '#c5ccd1',
      metalness: 0.92,
      roughness: 0.28,
    }),
    pearl: new THREE.MeshPhysicalMaterial({
      color: '#f6f1e6',
      metalness: 0.08,
      roughness: 0.16,
      iridescence: 1,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [120, 420],
      clearcoat: 0.6,
    }),
    slate: new THREE.MeshStandardMaterial({
      color: '#4e555b',
      roughness: 0.92,
      metalness: 0.04,
    }),
    floor: new THREE.MeshStandardMaterial({
      map: floor,
      roughness: 0.9,
      metalness: 0,
    }),
    lampShade: new THREE.MeshStandardMaterial({
      color: '#f3ead7',
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    lampInside: new THREE.MeshStandardMaterial({
      color: '#ffd7a8',
      emissive: '#ff9a3c',
      emissiveIntensity: 0.35,
      roughness: 0.5,
      side: THREE.BackSide,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: '#b08d57',
      metalness: 0.86,
      roughness: 0.32,
    }),
  }
}

export function setClothColor(cloth: THREE.MeshPhysicalMaterial, hex: string) {
  cloth.color.set(hex)
  const sheen = cloth.color.clone().lerp(new THREE.Color('#ffffff'), 0.42)
  cloth.sheenColor.copy(sheen)
}

export const CLOTH_PRESETS = [
  { name: '比赛绿', hex: '#127a3e' },
  { name: '电蓝', hex: '#1c4f9c' },
  { name: '酒红', hex: '#7a2436' },
  { name: '灰呢', hex: '#8d9088' },
]
