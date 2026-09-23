import * as THREE from 'three'

function person(shirt: number, skin: number, scale: number, bun: boolean) {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.72 })
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62 })
  const hairMat = new THREE.MeshStandardMaterial({ color: '#1a120e', roughness: 0.8 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 4, 10), cloth)
  body.position.y = 0.92
  body.scale.setScalar(scale)
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skinMat)
  head.position.y = 1.38 * scale
  head.scale.setScalar(scale)
  head.castShadow = true
  const hair = new THREE.Mesh(new THREE.SphereGeometry(bun ? 0.07 : 0.115, 12, 8), hairMat)
  hair.position.y = 1.46 * scale
  hair.scale.set(scale, scale * (bun ? 1 : 0.55), scale)
  const legMat = new THREE.MeshStandardMaterial({ color: '#2a241c', roughness: 0.8 })
  for (const x of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 3, 8), legMat)
    leg.position.set(x * scale, 0.28, 0)
    leg.scale.setScalar(scale)
    leg.castShadow = true
    g.add(leg)
  }
  g.add(body, head, hair)
  return g
}

function makeRevolver() {
  const root = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: '#6e747a', metalness: 0.72, roughness: 0.34 })
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.09, 0.046),
    new THREE.MeshStandardMaterial({ color: '#6a3a22', roughness: 0.6 }),
  )
  grip.position.y = -0.05
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 10), metal)
  barrel.rotation.z = Math.PI / 2
  barrel.position.set(0.07, 0.02, 0)
  const spin = new THREE.Group()
  spin.position.set(0.015, 0.02, 0)
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.038, 12), metal)
  cyl.rotation.z = Math.PI / 2
  spin.add(cyl)
  const chambers: THREE.Mesh[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.0075, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.4 }),
    )
    dot.position.set(0.02, Math.sin(a) * 0.016, Math.cos(a) * 0.016)
    spin.add(dot)
    chambers.push(dot)
  }
  root.add(grip, barrel, spin)
  return { root, spin, chambers }
}

function smokeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (!g) return null
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30)
  grd.addColorStop(0, 'rgba(236,236,236,0.75)')
  grd.addColorStop(1, 'rgba(236,236,236,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function createCinematic(scene: THREE.Scene) {
  const players = [person(0x1e3a5f, 0xc9956a, 1.05, false), person(0x6e2430, 0xe0b090, 0.96, true)]
  const east = players[0]
  const west = players[1]
  if (!east || !west) throw new Error('players')
  east.position.set(-0.05, 0, 1.28)
  west.position.set(0.62, 0, 1.3)
  east.rotation.y = 0.45
  west.rotation.y = -0.65
  east.visible = false
  west.visible = false

  const gun = makeRevolver()
  const cigar = new THREE.Group()
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8),
    new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.6 }),
  )
  stick.rotation.z = 1.1
  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ff7a2a' }),
  )
  cherry.position.set(0.04, 0.03, 0)
  cigar.add(stick, cherry)
  const tex = smokeTexture()
  const smokes: THREE.Sprite[] = []
  if (tex) {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }),
      )
      s.scale.setScalar(0.08)
      cigar.add(s)
      smokes.push(s)
    }
  }
  scene.add(east, west)

  let live = false
  let chosen = 0
  let t = 0
  let playing = false
  let reported = false

  return {
    get live() {
      return live
    },
    get elapsed() {
      return t
    },
    start(winner: 0 | 1) {
      const loaded = new Set<number>()
      while (loaded.size < 3) loaded.add(Math.floor(Math.random() * 6))
      chosen = Math.floor(Math.random() * 6)
      live = loaded.has(chosen)
      gun.chambers.forEach((dot, i) => {
        const mat = dot.material as THREE.MeshStandardMaterial
        const on = loaded.has(i)
        mat.color.set(on ? '#c83b2e' : '#2c2c2c')
        mat.emissive = new THREE.Color(on ? '#4a100c' : '#111111')
      })
      const win = players[winner]
      const lose = players[winner === 0 ? 1 : 0]
      if (!win || !lose) return
      win.add(cigar)
      cigar.position.set(0.06, 1.34, 0.1)
      lose.add(gun.root)
      gun.root.position.set(winner === 0 ? 0.16 : -0.16, 1.12, 0.18)
      gun.root.rotation.y = winner === 0 ? -0.8 : 0.8
      east.visible = true
      west.visible = true
      playing = true
      reported = false
      t = 0
    },
    update(dt: number): 'idle' | 'playing' | 'dry' | 'boom' {
      if (!playing) return 'idle'
      t += dt
      const u = Math.min(1, t / 2.15)
      gun.spin.rotation.x = (1 - u) * Math.PI * 10 + (chosen / 6) * Math.PI * 2
      smokes.forEach((s, i) => {
        const age = (t * 0.4 + i / smokes.length) % 1
        s.position.set(0.05, 0.06 + age * 0.4, 0)
        s.scale.setScalar(0.05 + age * 0.14)
        const mat = s.material
        mat.opacity = age < 0.15 ? (age / 0.15) * 0.5 : Math.max(0, 0.5 * (1 - age))
      })
      if (t > 2.5 && !reported) {
        reported = true
        return live ? 'boom' : 'dry'
      }
      return 'playing'
    },
    hide() {
      playing = false
      east.visible = false
      west.visible = false
    },
  }
}
