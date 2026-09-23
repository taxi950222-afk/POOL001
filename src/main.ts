import * as THREE from 'three'
import './style.css'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createAudio } from './audio.ts'
import { createBallMeshes } from './balls.ts'
import { createRoundEnd } from './cinematic.ts'
import { CLOTH_PRESETS, createMaterials, setClothColor } from './materials.ts'
import {
  allSleeping,
  ball,
  bothEdgesOpen,
  createWorld,
  lowestLive,
  placeCue,
  rackBalls,
  spotObject,
  step,
  strike,
  type Ball,
} from './physics.ts'
import {
  canOfferPass,
  createMatch,
  nextRack,
  onShotStart,
  passShot,
  resolve,
  type Match,
  type ShotFacts,
} from './rules.ts'
import { BED, ORDER, R, type BallId, type ObjectId } from './spec.ts'
import { buildCue, buildTable } from './table.ts'

const canvasQuery = document.querySelector<HTMLCanvasElement>('#view')
if (!canvasQuery) throw new Error('canvas')
const canvas: HTMLCanvasElement = canvasQuery

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0c0b0a')
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
pmrem.dispose()

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.05, 40)
camera.position.set(-1.7, 2.05, 1.9)
const controls = new OrbitControls(camera, canvas)
controls.target.set(0.05, 0.72, 0)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 1.15
controls.maxDistance = 7.2
controls.enablePan = false
controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE
const shot = new URLSearchParams(location.search).get('shot')
const shots: Record<string, { pos: [number, number, number]; target: [number, number, number]; polar?: number; min?: number }> = {
  side: { pos: [0.05, 1.02, 2.45], target: [0.05, 0.7, 0] },
  corner: { pos: [2.05, 1.15, 1.7], target: [0.2, 0.68, 0.05] },
  end: { pos: [2.65, 1.02, 0.02], target: [0, 0.7, 0] },
  under: { pos: [0.15, 0.05, 1.15], target: [0.05, 0.55, 0], polar: Math.PI * 0.96 },
  'pocket-side': { pos: [0.32, 1.02, 1.12], target: [0, 0.74, 0.64], min: 0.2 },
  'pocket-corner': { pos: [1.55, 1.02, 1.02], target: [1.22, 0.74, 0.58], min: 0.2 },
}
const framed = shot ? shots[shot] : undefined
if (framed) {
  controls.enableDamping = false
  if (framed.polar) controls.maxPolarAngle = framed.polar
  if (framed.min) controls.minDistance = framed.min
  camera.position.set(...framed.pos)
  controls.target.set(...framed.target)
  for (const id of ['hud', 'spin-wrap', 'power-wrap']) {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  }
}
controls.update()

const mats = createMaterials()
const table = buildTable(mats)
scene.add(table.root)
const hemi = new THREE.HemisphereLight('#6d655c', '#1a1612', 0)
const ambient = new THREE.AmbientLight('#2a2118', 0)
scene.add(hemi, ambient)
// Full level is the previous shade (spot 7) plus the fill that washed the cloth out.
// The slider is 0–100. 25 is a quarter of that shade, which is the default.
const LAMP_FULL = { spot: 7, hemi: 0.22, ambient: 0.08, inside: 0.35, bulb: 0.45, env: 1 }
const lampInput = must<HTMLInputElement>('#lamp')
const applyLamp = (percent: number) => {
  const f = Math.min(1, Math.max(0, percent / 100))
  for (const spot of table.lights) spot.intensity = LAMP_FULL.spot * f
  hemi.intensity = LAMP_FULL.hemi * f
  ambient.intensity = LAMP_FULL.ambient * f
  mats.lampInside.emissiveIntensity = LAMP_FULL.inside * f
  for (const bulb of table.bulbs) bulb.emissiveIntensity = LAMP_FULL.bulb * f
  scene.environmentIntensity = LAMP_FULL.env * f
}
applyLamp(Number(lampInput.value))
lampInput.addEventListener('input', () => applyLamp(Number(lampInput.value)))

const world = createWorld()
const balls = createBallMeshes()
scene.add(balls.group)
const cue = buildCue()
scene.add(cue)
const round = createRoundEnd()
const audio = createAudio()
const PLAYERS = ['东泽', '日峰'] as const

const ghost = new THREE.Mesh(
  new THREE.SphereGeometry(R, 18, 12),
  new THREE.MeshBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.35 }),
)
ghost.visible = false
scene.add(ghost)

const aimGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(1, 0, 0),
])
const aimLine = new THREE.Line(
  aimGeo,
  new THREE.LineBasicMaterial({ color: '#f2e6c8', transparent: true, opacity: 0.7 }),
)
scene.add(aimLine)

type Mode = 'aim' | 'bih' | 'charge' | 'sim' | 'cine' | 'end'
let mode: Mode = 'aim'
let match: Match = createMatch()
let aimX = 1
let aimZ = 0
let spinX = 0
let spinY = 0
let chargeT = 0
let power = 0
let accum = 0
let sleepT = 0
let simTime = 0
let roundT = 0
let cardOn = false
let jackpot: '大金' | '小金' | null = null
const before = new Map<BallId, Ball['state']>()
let shotLegal: ObjectId = '1'
let shotUp: ObjectId[] = ['1', '2', '3', '9']
const dropping = new Map<BallId, number>()

const turnEl = must('#turn')
const callEl = must('#call')
const scoreA = must('#score-a')
const scoreB = must('#score-b')
const passBtn = must<HTMLButtonElement>('#pass')
const reballBtn = must<HTMLButtonElement>('#reball')
const powerFill = must('#power-fill')
const clothInput = must<HTMLInputElement>('#cloth')
const swatches = must('#swatches')
const spinPad = must('#spin')
const spinDot = must('#spin-dot')
const toastEl = must('#toast')
const jackpotEl = must('#jackpot')
const jackpotWord = must('#jackpot-word')
const settleEl = must('#settle')
const settleLine = must('#settle-line')
const settleWin = must('#settle-win')
const settleLose = must('#settle-lose')
const settleNext = must('#settle-next')
const endA = must('#end-a')
const endB = must('#end-b')
const again = must<HTMLButtonElement>('#again')

for (const preset of CLOTH_PRESETS) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = preset.name
  btn.style.background = preset.hex
  btn.dataset.hex = preset.hex
  if (preset.hex === '#127a3e') btn.classList.add('on')
  btn.addEventListener('click', () => applyCloth(preset.hex))
  swatches.append(btn)
}

clothInput.addEventListener('input', () => applyCloth(clothInput.value))
passBtn.addEventListener('click', () => {
  if (mode !== 'aim' || !canOfferPass(match, bothEdgesOpen(world))) return
  passShot(match, liveObjects())
  resetSpin()
  toast('让杆')
  syncHud()
})
reballBtn.addEventListener('click', () => {
  match.ballInHand = true
  ball(world, 'cue').state = 'off'
  mode = 'bih'
  syncHud()
})
again.addEventListener('click', () => {
  match = createMatch()
  rackBalls(world)
  for (const mesh of Object.values(balls.meshes)) {
    mesh.visible = true
    mesh.quaternion.identity()
  }
  dropping.clear()
  closeRound()
  resetSpin()
  mode = 'aim'
  aimX = 1
  aimZ = 0
  camera.position.set(-1.7, 2.05, 1.9)
  controls.target.set(0.05, 0.72, 0)
  syncHud()
})

spinPad.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  spinPad.setPointerCapture(e.pointerId)
  setSpin(e.clientX, e.clientY)
})
spinPad.addEventListener('pointermove', (e) => {
  if (spinPad.hasPointerCapture(e.pointerId)) setSpin(e.clientX, e.clientY)
})

canvas.addEventListener('contextmenu', (e) => e.preventDefault())
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  audio.resume()
  if (mode === 'end' || mode === 'cine' || mode === 'sim') return
  const point = clothPoint(e)
  if (!point) return
  if (mode === 'bih') {
    if (placeCue(world, point.x, point.z)) mode = 'aim'
    else toast('这里放不下')
    syncHud()
    return
  }
  if (mode === 'aim' && lowestLive(world)) {
    setAim(point.x, point.z)
    mode = 'charge'
    chargeT = 0
    power = 0
    canvas.setPointerCapture(e.pointerId)
  }
})
canvas.addEventListener('pointermove', (e) => {
  const point = clothPoint(e)
  if (!point) return
  if (mode === 'bih') {
    ghost.visible = true
    ghost.position.set(point.x, BED + R, point.z)
  } else if (mode === 'aim' || mode === 'charge') {
    setAim(point.x, point.z)
  }
})
canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'charge') return
  if (power < 0.03) {
    mode = 'aim'
    power = 0
    return
  }
  beginShot()
  void e
})

const raycaster = new THREE.Raycaster()
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BED)
const hit = new THREE.Vector3()
const ndc = new THREE.Vector2()
const spinQuat = new THREE.Quaternion()
const spinAxis = new THREE.Vector3()

function clothPoint(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect()
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray.intersectPlane(plane, hit)
}

function setAim(x: number, z: number) {
  const cueBall = ball(world, 'cue')
  const dx = x - cueBall.x
  const dz = z - cueBall.z
  if (Math.hypot(dx, dz) < 0.05) return
  aimX = dx
  aimZ = dz
}

function setSpin(clientX: number, clientY: number) {
  const rect = spinPad.getBoundingClientRect()
  let nx = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
  let ny = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
  const mag = Math.hypot(nx, ny)
  if (mag > 1) {
    nx /= mag
    ny /= mag
  }
  spinX = nx * R * 0.5
  spinY = -ny * R * 0.5
  spinDot.style.left = `${50 + nx * 50}%`
  spinDot.style.top = `${50 + ny * 50}%`
}

function applyCloth(hex: string) {
  setClothColor(mats.cloth, hex)
  clothInput.value = hex
  for (const btn of swatches.querySelectorAll('button')) {
    btn.classList.toggle('on', btn.dataset.hex?.toLowerCase() === hex.toLowerCase())
  }
}

function liveObjects(): ObjectId[] {
  return ORDER.filter((id) => ball(world, id).state === 'live')
}

function resetSpin() {
  spinX = 0
  spinY = 0
  spinDot.style.left = '50%'
  spinDot.style.top = '50%'
}

function jackpotOf(call: string): '大金' | '小金' | null {
  if (call.includes('小金')) return '小金'
  if (call.includes('大金')) return '大金'
  return null
}

function closeRound() {
  settleEl.hidden = true
  jackpotEl.hidden = true
  again.hidden = true
  cardOn = false
  jackpot = null
  roundT = 0
}

function revealRound() {
  if (match.winner === null || match.loser === null) return
  const liveRound = round.live
  const loser = PLAYERS[match.loser]
  const winner = PLAYERS[match.winner]
  settleLine.textContent = liveRound ? `实弹！${loser}没能逃过` : `空枪！${loser}逃过一劫`
  settleWin.textContent = `${winner} 抽烟`
  settleLose.textContent = `${loser} 对枪`
  endA.textContent = String(match.scores[0])
  endB.textContent = String(match.scores[1])
  settleNext.textContent = liveRound ? '对局结束' : `下一局 ${loser} 开球`
  again.hidden = !liveRound
  jackpotEl.hidden = true
  settleEl.hidden = false
  cardOn = true
  if (liveRound) audio.live()
  else audio.click()
}

function beginShot() {
  const legal = lowestLive(world)
  if (!legal || ball(world, 'cue').state !== 'live') {
    mode = 'aim'
    return
  }
  shotLegal = legal
  shotUp = liveObjects()
  for (const b of world.balls) before.set(b.id, b.state)
  onShotStart(match)
  const len = Math.hypot(aimX, aimZ) || 1
  strike(world, aimX / len, aimZ / len, power, spinX, spinY)
  audio.cue(power)
  accum = 0
  sleepT = 0
  simTime = 0
  mode = 'sim'
  power = 0
}

function finishShot() {
  const pocketed: BallId[] = []
  const off: BallId[] = []
  for (const b of world.balls) {
    const prev = before.get(b.id)
    if (prev !== 'live') continue
    if (b.state === 'pocket') pocketed.push(b.id)
    if (b.state === 'off') off.push(b.id)
  }
  const facts: ShotFacts = {
    legal: shotLegal,
    first: world.firstContact ?? 'none',
    pocketed,
    off,
    nineStruckBy: world.nineLast,
    upBefore: shotUp,
  }
  const playerBefore = match.current
  const result = resolve(match, facts)
  if (match.current !== playerBefore) resetSpin()
  for (const id of result.spot) spotObject(world, id)
  if (match.ballInHand) {
    const cueBall = ball(world, 'cue')
    cueBall.state = 'off'
    cueBall.vx = cueBall.vy = cueBall.vz = 0
  }
  toast(match.lastCall)
  if (result.rackOver && match.winner !== null) {
    mode = 'cine'
    roundT = 0
    cardOn = false
    jackpot = jackpotOf(match.lastCall)
    round.start()
    if (jackpot) {
      jackpotWord.textContent = jackpot
      jackpotEl.hidden = false
      settleEl.hidden = true
    } else revealRound()
  } else if (match.ballInHand) mode = 'bih'
  else mode = 'aim'
  syncHud()
}

function toast(text: string) {
  toastEl.textContent = text
  toastEl.classList.add('show')
  window.setTimeout(() => toastEl.classList.remove('show'), 1600)
}

function syncHud() {
  scoreA.textContent = String(match.scores[0])
  scoreB.textContent = String(match.scores[1])
  const name = PLAYERS[match.current]
  if (mode === 'sim') turnEl.textContent = '球在走'
  else if (mode === 'cine') turnEl.textContent = '这一局结束'
  else if (mode === 'end') turnEl.textContent = '结算'
  else if (match.ballInHand || mode === 'bih') turnEl.textContent = `${name} 自由球`
  else if (match.isBreakShot) turnEl.textContent = `${name} 开球`
  else turnEl.textContent = `${name} 击球`
  callEl.textContent = match.lastCall
  passBtn.disabled = mode !== 'aim' || !canOfferPass(match, bothEdgesOpen(world))
  reballBtn.hidden = !(match.ballInHand && mode === 'aim')
  powerFill.style.transform = `scaleX(${mode === 'charge' ? power : 0})`
}

function layout() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / Math.max(1, h)
  camera.fov = w < 720 ? 46 : 36
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

window.addEventListener('resize', layout)
layout()

let last = performance.now()
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (mode === 'charge') {
    chargeT += dt
    const period = 1.25
    const phase = (chargeT % (period * 2)) / period
    power = phase <= 1 ? phase : 2 - phase
  }
  if (mode === 'sim') {
    accum += dt
    simTime += dt
    const sub = 1 / 600
    let guard = 0
    while (accum >= sub && guard < 24) {
      for (const ev of step(world, sub)) {
        if (ev.t === 'ball') audio.ball(ev.speed)
        else if (ev.t === 'cushion') audio.cushion(ev.speed)
        else if (ev.t === 'pocket') audio.pocket(ev.speed)
      }
      accum -= sub
      guard++
    }
    if (allSleeping(world)) sleepT += dt
    else sleepT = 0
    if (sleepT > 0.18 || simTime > 12) finishShot()
  }
  if (mode === 'cine') {
    roundT += dt
    if (jackpot && !cardOn && roundT >= 2.1) revealRound()
    if (cardOn && round.live) {
      match.gameOver = true
      mode = 'end'
    } else if (cardOn && !round.live && roundT >= (jackpot ? 5.3 : 3.2) && match.loser !== null) {
      const breaker = match.loser
      closeRound()
      nextRack(match, breaker)
      resetSpin()
      rackBalls(world)
      for (const mesh of Object.values(balls.meshes)) mesh.quaternion.identity()
      dropping.clear()
      camera.position.set(-1.7, 2.05, 1.9)
      controls.target.set(0.05, 0.72, 0)
      mode = 'aim'
      toast('下一局')
    }
  }

  for (const b of world.balls) {
    const mesh = balls.meshes[b.id]
    if (b.state === 'live') {
      dropping.delete(b.id)
      mesh.visible = true
      mesh.position.set(b.x, b.y, b.z)
      const w = Math.hypot(b.wx, b.wy, b.wz)
      if (w > 0.02) {
        spinAxis.set(b.wx / w, b.wy / w, b.wz / w)
        spinQuat.setFromAxisAngle(spinAxis, w * dt)
        mesh.quaternion.premultiply(spinQuat)
      }
    } else if (b.state === 'pocket') {
      const age = (dropping.get(b.id) ?? 0) + dt
      dropping.set(b.id, age)
      mesh.visible = age < 0.45
      mesh.position.set(b.x, BED + R - age * 0.7, b.z)
    } else {
      mesh.visible = false
    }
  }

  const cueBall = ball(world, 'cue')
  const aiming = (mode === 'aim' || mode === 'charge') && cueBall.state === 'live'
  cue.visible = aiming
  aimLine.visible = aiming
  ghost.visible = mode === 'bih'
  if (aiming) {
    const len = Math.hypot(aimX, aimZ) || 1
    const dx = aimX / len
    const dz = aimZ / len
    const pull = 0.05 + (mode === 'charge' ? power * 0.42 : 0)
    cue.position.set(cueBall.x - dx * pull, cueBall.y, cueBall.z - dz * pull)
    cue.rotation.y = Math.atan2(-dz, dx)
    const attr = aimGeo.getAttribute('position')
    attr.setXYZ(0, cueBall.x, BED + 0.004, cueBall.z)
    attr.setXYZ(1, cueBall.x + dx * 0.85, BED + 0.004, cueBall.z + dz * 0.85)
    attr.needsUpdate = true
  }
  controls.enabled = mode === 'aim' || mode === 'bih' || mode === 'charge'
  controls.update()
  syncHud()
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function must<T extends Element = HTMLElement>(sel: string) {
  const node = document.querySelector<T>(sel)
  if (!node) throw new Error(sel)
  return node
}
