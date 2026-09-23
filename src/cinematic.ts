/** Flat round-end roll: 6 chambers, 3 loaded, one chosen at random. No scene objects. */

export function createRoundEnd() {
  let live = false
  return {
    get live() {
      return live
    },
    start() {
      const loaded = new Set<number>()
      while (loaded.size < 3) loaded.add(Math.floor(Math.random() * 6))
      live = loaded.has(Math.floor(Math.random() * 6))
    },
  }
}
