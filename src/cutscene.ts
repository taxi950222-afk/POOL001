export interface CutsceneAudio {
  spinCylinder(): void
  gunshot(): void
  clickEmpty(): void
}

type Kind = 'cigar' | 'roulette'
type Pose = 'smoke' | 'gun' | 'down'

export class Cutscene {
  private readonly ctx: CanvasRenderingContext2D
  private active = false
  private hold = false
  private t = 0
  private kind: Kind | null = null
  private onDone: ((dead: boolean) => void) | null = null
  private bulletChamber = 0
  private liveChambers: number[] = []
  private fired = false
  private dead = false
  private winnerName = ''
  private loserName = ''

  private readonly canvas: HTMLCanvasElement
  private readonly audio: CutsceneAudio

  constructor(canvas: HTMLCanvasElement, audio: CutsceneAudio) {
    this.canvas = canvas
    this.audio = audio
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('cutscene')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.hold) return
      e.preventDefault()
      e.stopPropagation()
      this.skip()
    })
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    if (this.active) this.draw()
  }

  get running() {
    return this.active
  }

  play({
    winnerName,
    loserName,
    onDone,
  }: {
    winnerName: string
    loserName: string
    onDone: (dead: boolean) => void
  }) {
    this.active = true
    this.hold = false
    this.t = 0
    this.kind = 'cigar'
    this.fired = false
    this.dead = false
    this.winnerName = winnerName
    this.loserName = loserName
    const slots = [0, 1, 2, 3, 4, 5]
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = slots[i] ?? 0
      const b = slots[j] ?? 0
      slots[i] = b
      slots[j] = a
    }
    this.liveChambers = slots.slice(0, 3)
    this.bulletChamber = Math.floor(Math.random() * 6)
    this.onDone = onDone
    this.canvas.style.pointerEvents = 'auto'
    this.draw()
  }

  /** Frozen frame for screenshots. Does not roll and does not play audio. */
  show(frame: 'cigar' | 'spin' | 'dry' | 'live') {
    this.play({ winnerName: '东泽', loserName: '日峰', onDone: () => {} })
    this.hold = true
    this.liveChambers = [0, 2, 4]
    this.bulletChamber = frame === 'live' ? 0 : 1
    if (frame === 'cigar') {
      this.kind = 'cigar'
      this.t = 1.2
    } else if (frame === 'spin') {
      this.kind = 'roulette'
      this.t = 0.85
      this.fired = false
      this.dead = false
    } else {
      this.kind = 'roulette'
      this.t = 3.4
      this.fired = true
      this.dead = frame === 'live'
    }
    this.draw()
  }

  stop() {
    this.active = false
    this.kind = null
    this.canvas.style.pointerEvents = 'none'
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const hud = document.getElementById('hud')
    if (hud) hud.style.opacity = '1'
  }

  update(dt: number) {
    if (!this.active) return
    if (this.hold) {
      this.draw()
      return
    }
    this.t += dt
    if (this.kind === 'cigar' && this.t > 3.4) {
      this.kind = 'roulette'
      this.t = 0
      this.audio.spinCylinder()
    }
    if (this.kind === 'roulette' && this.t > 2.35 && !this.fired) {
      this.fired = true
      this.dead = this.liveChambers.includes(this.bulletChamber)
      if (this.dead) this.audio.gunshot()
      else this.audio.clickEmpty()
    }
    if (this.kind === 'roulette' && this.t > 5.2) {
      const dead = this.dead
      const cb = this.onDone
      this.stop()
      if (cb) cb(dead)
      return
    }
    this.draw()
  }

  private skip() {
    if (!this.active) return
    if (this.kind === 'cigar') {
      this.kind = 'roulette'
      this.t = 0
      this.audio.spinCylinder()
      return
    }
    if (this.kind === 'roulette' && !this.fired) {
      this.t = 2.4
      return
    }
    if (this.kind === 'roulette' && this.fired) {
      const dead = this.dead
      const cb = this.onDone
      this.stop()
      if (cb) cb(dead)
    }
  }

  private draw() {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.clearRect(0, 0, w, h)
    if (!this.active) return
    ctx.fillStyle = 'rgba(8,5,3,0.72)'
    ctx.fillRect(0, 0, w, h)
    if (this.kind === 'cigar') this.drawCigar(w, h)
    else if (this.kind === 'roulette') this.drawRoulette(w, h)
    const hud = document.getElementById('hud')
    if (hud) hud.style.opacity = '0.15'
  }

  private drawCowboy(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    palette: { coat: string; pants: string; skin: string; hat: string },
    pose: Pose,
  ) {
    ctx.save()
    if (pose === 'down') {
      ctx.translate(x + 30, y + 90)
      ctx.rotate(1.22)
      ctx.scale(scale, scale)
    } else {
      ctx.translate(x, y)
      ctx.scale(scale, scale)
    }
    ctx.fillStyle = palette.coat
    ctx.fillRect(-28, -10, 56, 90)
    ctx.fillStyle = palette.pants
    ctx.fillRect(-22, 70, 18, 70)
    ctx.fillRect(4, 70, 18, 70)
    ctx.fillStyle = '#3a2414'
    ctx.fillRect(-24, 132, 22, 10)
    ctx.fillRect(4, 132, 22, 10)
    ctx.fillStyle = palette.skin
    ctx.beginPath()
    ctx.arc(0, -38, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = palette.hat
    ctx.beginPath()
    ctx.ellipse(0, -52, 34, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-16, -72, 32, 22)
    ctx.fillStyle = '#1a120c'
    ctx.fillRect(-12, -44, 24, 5)
    if (pose === 'smoke') {
      ctx.fillStyle = palette.skin
      ctx.fillRect(24, 8, 10, 36)
      ctx.fillStyle = '#6b3a22'
      ctx.fillRect(30, -2, 4, 14)
      ctx.fillStyle = '#f2c14b'
      ctx.beginPath()
      ctx.arc(32, -4, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    if (pose === 'gun') {
      ctx.fillStyle = palette.skin
      ctx.fillRect(-58, -28, 14, 36)
      ctx.fillStyle = '#2b2b2b'
      ctx.beginPath()
      ctx.moveTo(-8, -46)
      ctx.lineTo(-8, -32)
      ctx.lineTo(-52, -36)
      ctx.lineTo(-52, -50)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#1a120c'
      ctx.fillRect(-12, -43, 6, 8)
      ctx.fillStyle = '#c9a15b'
      ctx.beginPath()
      ctx.arc(-34, -41, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3a2414'
      ctx.fillRect(-54, -34, 8, 18)
    }
    ctx.restore()
  }

  private drawCigar(w: number, h: number) {
    const ctx = this.ctx
    this.drawCowboy(ctx, w * 0.5, h * 0.42, 1.6, {
      coat: '#4a2a18',
      pants: '#2a2118',
      skin: '#c9a07a',
      hat: '#1c140e',
    }, 'smoke')
    const puffs = 8
    ctx.globalAlpha = 0.35
    for (let i = 0; i < puffs; i++) {
      const u = (this.t * 0.35 + i * 0.12) % 1
      ctx.fillStyle = '#d8d0c4'
      ctx.beginPath()
      ctx.arc(w * 0.5 + 58 + u * 40 + Math.sin(i) * 10, h * 0.33 - u * 120, 10 + u * 18, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    this.caption(w, h, `${this.winnerName} 点燃一支雪茄`, '胜局入账。点击可跳过。')
  }

  private drawRoulette(w: number, h: number) {
    const ctx = this.ctx
    const pose: Pose = this.fired && this.dead && this.t > 2.7 ? 'down' : 'gun'
    this.drawCowboy(ctx, w * 0.5, h * 0.42, 1.6, {
      coat: '#2c3338',
      pants: '#1b1e22',
      skin: '#b98964',
      hat: '#111111',
    }, pose)
    ctx.save()
    ctx.translate(w * 0.78, h * 0.38)
    const spin = this.fired ? this.bulletChamber * (Math.PI / 3) : this.t * 14
    ctx.rotate(spin)
    ctx.strokeStyle = '#c9a15b'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(0, 0, 54, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 28, Math.sin(a) * 28, 10, 0, Math.PI * 2)
      ctx.fillStyle = this.liveChambers.includes(i) ? '#7a1f16' : '#2a2118'
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
    if (this.fired && this.dead && this.t < 2.9) {
      ctx.fillStyle = `rgba(255,180,80,${Math.max(0, 1 - (this.t - 2.35) * 3)})`
      ctx.beginPath()
      ctx.arc(w * 0.47, h * 0.28, 80, 0, Math.PI * 2)
      ctx.fill()
    }
    let title = `${this.loserName} 转动弹舱……六分之三`
    let sub = '三发实弹，三发空仓。点击跳过。'
    if (this.fired && this.dead) {
      title = `${this.loserName} 倒在锯末上`
      sub = '命运已至。本场对决结束。'
    } else if (this.fired) {
      title = '空响。他还活着。'
      sub = '擦去冷汗，下一局由胜者开球。'
    }
    this.caption(w, h, title, sub)
  }

  private caption(w: number, h: number, title: string, sub: string) {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(20,12,6,0.82)'
    ctx.fillRect(w * 0.18, h * 0.78, w * 0.64, 90)
    ctx.strokeStyle = '#c9a15b'
    ctx.strokeRect(w * 0.18, h * 0.78, w * 0.64, 90)
    ctx.fillStyle = '#f0d9a8'
    ctx.font = '22px Cinzel, "Noto Serif SC", "WenQuanYi Micro Hei", "Droid Sans Fallback", serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, w / 2, h * 0.78 + 38)
    ctx.font = '16px "Noto Serif SC", "WenQuanYi Micro Hei", "Droid Sans Fallback", serif'
    ctx.fillStyle = '#d7c4a0'
    ctx.fillText(sub, w / 2, h * 0.78 + 66)
  }
}
