import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createPocketMesh, setPocketWireframe } from './mesh.ts'

const corner = createPocketMesh('corner')
corner.position.set(-0.24, 0, 0)
const side = createPocketMesh('side')
side.position.set(0.24, 0, 0)

const pockets = new THREE.Group()
pockets.add(corner, side)
setPocketWireframe(pockets, true)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#121411')
scene.add(pockets)

const cloth = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.5, 0, -0.004, 0.5, 0, -0.004, -0.5, 0, -0.004, -0.5, 0, -0.16, 0.5, 0, -0.004, 0.5, 0, -0.16],
      3,
    ),
  ),
  new THREE.LineBasicMaterial({ color: '#3d7a52' }),
)
scene.add(cloth)

scene.add(new THREE.AmbientLight('#ffffff', 0.65))
const key = new THREE.DirectionalLight('#fff6ea', 1.1)
key.position.set(0.4, 0.9, -0.4)
scene.add(key)

const shot = new URLSearchParams(window.location.search).get('view')
const labelCorner = document.querySelector('#label-corner')
const labelSide = document.querySelector('#label-side')

let frustum = 0.32
const look = new THREE.Vector3(0, -0.02, 0.045)
if (shot === 'side') {
  corner.visible = false
  cloth.visible = false
  frustum = 0.1
  look.set(side.position.x, -0.028, 0.064)
  if (labelCorner instanceof HTMLElement) labelCorner.hidden = true
  if (labelSide instanceof HTMLElement) labelSide.textContent = '中袋 · 侧视'
  scene.add(clothMark(side.position.x))
} else if (shot === 'corner') {
  side.visible = false
  cloth.visible = false
  frustum = 0.15
  look.set(corner.position.x, -0.02, 0.05)
  if (labelSide instanceof HTMLElement) labelSide.hidden = true
  if (labelCorner instanceof HTMLElement) labelCorner.textContent = '角袋 · 侧视'
  scene.add(clothMark(corner.position.x))
}

const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.01, 20)
camera.up.set(0, 1, 0)
if (shot === 'side') camera.position.set(side.position.x - 1.4, look.y, look.z)
else if (shot === 'corner') camera.position.set(corner.position.x + 0.55, 0.2, -0.2)
else camera.position.set(0.38, 0.46, -0.46)
camera.lookAt(look)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.copy(look)
controls.enableDamping = false
controls.update()

const wireButton = document.querySelector('#wire')
if (!(wireButton instanceof HTMLButtonElement)) throw new Error('missing wire toggle')
let wire = true
wireButton.addEventListener('click', () => {
  wire = !wire
  wireButton.setAttribute('aria-pressed', wire ? 'true' : 'false')
  setPocketWireframe(pockets, wire)
})

window.addEventListener('resize', () => {
  const next = window.innerWidth / window.innerHeight
  camera.left = -frustum * next
  camera.right = frustum * next
  camera.top = frustum
  camera.bottom = -frustum
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function clothMark(x: number) {
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute([x, 0, -0.04, x, 0, 0.16], 3),
    ),
    new THREE.LineBasicMaterial({ color: '#3d7a52' }),
  )
}

function frame() {
  renderer.render(scene, camera)
}
frame()
renderer.setAnimationLoop(frame)
