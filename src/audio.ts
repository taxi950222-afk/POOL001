export function createAudio() {
  const AudioCtx = window.AudioContext
  let ctx: AudioContext | null = null
  let noise: AudioBuffer | null = null
  let last = 0

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

  function allow() {
    const now = performance.now()
    if (now - last < 28) return false
    last = now
    return true
  }

  return {
    resume() {
      context()
    },
    cue(power: number) {
      burst(140 + power * 80, 0.09, 'sine', 0.22 + power * 0.18, 900, 0.7)
    },
    ball(speed: number) {
      if (!allow()) return
      const g = Math.min(0.22, 0.04 + speed * 0.03)
      burst(1800 + Math.min(speed, 6) * 180, 0.045, 'triangle', g, 2400, 1.2)
    },
    cushion(speed: number) {
      if (!allow()) return
      const g = Math.min(0.18, 0.035 + speed * 0.02)
      burst(220, 0.07, 'sine', g, 700, 0.6)
    },
    pocket() {
      burst(180, 0.16, 'sine', 0.16, 400, 0.8)
    },
    click() {
      burst(2400, 0.04, 'square', 0.08, 3000, 2)
    },
    live() {
      burst(90, 0.18, 'sine', 0.2, 240, 0.5)
    },
  }
}
