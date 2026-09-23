/** Flat round-end roll: 6 chambers, 3 loaded, one chosen at random. No scene objects. */

export function createRoundEnd() {
  let live = false
  let chamber = 0
  let loaded = [false, false, false, false, false, false]

  return {
    get live() {
      return live
    },
    /** Index 0–5 of the chamber that stops under the hammer. */
    get chamber() {
      return chamber
    },
    /** True where that chamber was loaded. Always three trues. */
    get loaded() {
      return loaded
    },
    start() {
      const flags = [false, false, false, false, false, false]
      const picked = new Set<number>()
      while (picked.size < 3) picked.add(Math.floor(Math.random() * 6))
      for (const i of picked) flags[i] = true
      chamber = Math.floor(Math.random() * 6)
      loaded = flags
      live = picked.has(chamber)
    },
    /** Frozen card for screenshots. Same 3-of-6 load, no extra roll. */
    show(outcome: 'dry' | 'live') {
      loaded = [true, false, true, false, true, false]
      chamber = outcome === 'live' ? 0 : 1
      live = loaded[chamber] === true
    },
  }
}
