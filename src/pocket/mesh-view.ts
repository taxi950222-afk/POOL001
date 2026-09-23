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

const aspect = window.innerWidth / window.innerHeight
const frustum = 0.32
const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, 0.01, 20)
camera.position.set(0.38, 0.46, -0.46)
camera.lookAt(0, -0.02, 0.045)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, -0.02, 0.045)
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

function frame() {
  renderer.render(scene, camera)
}
frame()
renderer.setAnimationLoop(frame)
