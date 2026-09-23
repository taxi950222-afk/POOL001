import { createCornerProfile } from './profile.ts'

const canvas = document.querySelector('canvas')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('missing canvas')
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('missing 2d context')

const pts = createCornerProfile()
const w = canvas.width
const h = canvas.height
ctx.fillStyle = '#121411'
ctx.fillRect(0, 0, w, h)

const xs = pts.map((p) => p.x)
const zs = pts.map((p) => p.z)
const minX = Math.min(...xs)
const maxX = Math.max(...xs)
const minZ = Math.min(...zs)
const maxZ = Math.max(...zs)
const cx = (minX + maxX) / 2
const cz = (minZ + maxZ) / 2
const scale = Math.min((w * 0.78) / (maxX - minX), (h * 0.72) / (maxZ - minZ))
const toX = (x: number) => w / 2 + (x - cx) * scale
const toY = (z: number) => h * 0.56 - (z - cz) * scale

ctx.strokeStyle = '#8d9284'
ctx.lineWidth = 1
ctx.beginPath()
ctx.moveTo(toX(0), toY(minZ - 0.01))
ctx.lineTo(toX(0), toY(maxZ + 0.012))
ctx.moveTo(toX(minX - 0.012), toY(0))
ctx.lineTo(toX(maxX + 0.012), toY(0))
ctx.stroke()

ctx.fillStyle = '#8d9284'
ctx.font = '22px sans-serif'
ctx.fillText('+z', toX(0) + 8, toY(maxZ + 0.012) + 8)
ctx.fillText('+x', toX(maxX + 0.012) - 28, toY(0) - 10)
ctx.fillText('角袋口沿', 36, 48)

ctx.strokeStyle = '#f4f1e8'
ctx.lineWidth = 3
ctx.lineJoin = 'round'
ctx.lineCap = 'round'
ctx.beginPath()
pts.forEach((p, i) => {
  const x = toX(p.x)
  const y = toY(p.z)
  if (i === 0) ctx.moveTo(x, y)
  else ctx.lineTo(x, y)
})
ctx.closePath()
ctx.stroke()
