

export const padCordAwayFromEdge = (val: number) => {
  const padding = 0.01
  return clamp(val, 0 + padding, 1 - padding)
}

export const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value))
}