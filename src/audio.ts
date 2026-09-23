export function createAudio() {
  const AudioCtx = window.AudioContext
  let ctx: AudioContext | null = null
  let noise: AudioBuffer | null = null
  const lastHit = { ball: 0, cushion: 0 }

  function context() {
    if (!ctx) {
      ctx = new AudioCtx()
      const n = Math.floor(ctx.sampleRate * 0.25)
      noise = ctx.createBuffer(1, n, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  function burst(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    filterFreq: number,
    q: number,
  ) {
    const ac = context()
    if (!noise) return
    const t = ac.currentTime
    const osc = ac.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur)
    const src = ac.createBufferSource()
    src.buffer = noise
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = q
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    src.connect(filter)
    filter.connect(g)
    g.connect(ac.destination)
    osc.start(t)
    src.start(t)
    osc.stop(t + dur + 0.02)
    src.stop(t + dur + 0.02)
  }

  function allow(kind: 'ball' | 'cushion') {
    const now = performance.now()
    if (now - lastHit[kind] < 32) return false
    lastHit[kind] = now
    return true
  }

  function level(speed: number, quiet: number, per: number, cap: number) {
    return Math.min(cap, quiet + Math.max(0, speed) * per)
  }

  return {
    resume() {
      context()
    },
    cue(power: number) {
      const p = Math.max(0, Math.min(1, power))
      burst(120 + p * 90, 0.08, 'sine', 0.12 + p * 0.28, 420, 0.6)
    },
    ball(speed: number) {
      if (!allow('ball')) return
      burst(1600 + Math.min(speed, 8) * 160, 0.04, 'triangle', level(speed, 0.03, 0.045, 0.32), 2800, 1.4)
    },
    cushion(speed: number) {
      if (!allow('cushion')) return
      burst(180 + Math.min(speed, 6) * 24, 0.07, 'sine', level(speed, 0.03, 0.028, 0.26), 640, 0.55)
    },
    pocket(speed: number) {
      burst(140, 0.18, 'sine', level(speed, 0.05, 0.04, 0.3), 360, 0.7)
    },
    click() {
      burst(2400, 0.04, 'square', 0.08, 3000, 2)
    },
    live() {
      burst(90, 0.18, 'sine', 0.2, 240, 0.5)
    },
  }
}
