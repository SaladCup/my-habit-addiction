/**
 * Weighted random selection.
 * @param {Array<{value: any, weight: number}>} options
 * @returns {any} selected value
 */
export function weightedRandom(options) {
  const total = options.reduce((sum, o) => sum + o.weight, 0)
  let r = Math.random() * total
  for (const o of options) {
    r -= o.weight
    if (r <= 0) return o.value
  }
  return options[options.length - 1].value
}

/**
 * Pick a random float between min and max.
 */
export function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * Pick a random integer between min and max (inclusive).
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
