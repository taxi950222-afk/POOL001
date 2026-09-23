import * as THREE from 'three'
import { BALL_D, type BallId } from './spec.ts'

function paint(label: string, fill: string, stripe: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas')
  g.fillStyle = stripe ? '#f3efe6' : fill
  g.fillRect(0, 0, 256, 256)
  if (stripe) {
    g.fillStyle = fill
    g.fillRect(0, 92, 256, 72)
  }
  if (!stripe) {
    const grain = g.getImageData(0, 0, 256, 256)
    g.putImageData(grain, 0, 0)
  }
  const draw = (cx: number) => {
    g.beginPath()
    g.fillStyle = '#f7f4ee'
    g.arc(cx, 128, 26, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = 'rgba(0,0,0,0.35)'
    g.stroke()
    g.fillStyle = '#161616'
    g.font = '700 34px Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, cx, 130)
  }
  if (label) {
    draw(64)
    draw(192)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const LOOK: Record<BallId, { color: string; stripe: boolean; label: string }> = {
  cue: { color: '#f4f1ea', stripe: false, label: '' },
  '1': { color: '#f0c400', stripe: false, label: '1' },
  '2': { color: '#1d4e9c', stripe: false, label: '2' },
  '3': { color: '#d01218', stripe: false, label: '3' },
  '9': { color: '#f0c400', stripe: true, label: '9' },
}

export function createBallMeshes() {
  const geo = new THREE.SphereGeometry(BALL_D / 2, 32, 24)
  const meshes: Record<BallId, THREE.Mesh> = {} as Record<BallId, THREE.Mesh>
  const group = new THREE.Group()
  for (const id of Object.keys(LOOK) as BallId[]) {
    const look = LOOK[id]
    const mat = new THREE.MeshPhysicalMaterial({
      map: id === 'cue' ? null : paint(look.label, look.color, look.stripe),
      color: id === 'cue' ? look.color : '#ffffff',
      roughness: id === 'cue' ? 0.18 : 0.22,
      metalness: 0.04,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = id
    meshes[id] = mesh
    group.add(mesh)
  }
  return { group, meshes }
}
