import { Node } from '../consts'

/**
 * Calculate the centroid (centre of mass) of a set of points
 */
export const calculateCentroid = (points: Node[]): { x: number; y: number } => {
  if (points.length === 0) return { x: 0, y: 0 }
  
  const sumX = points.reduce((sum, point) => sum + point.x, 0)
  const sumY = points.reduce((sum, point) => sum + point.y, 0)
  
  return {
    x: sumX / points.length,
    y: sumY / points.length
  }
}

/**
 * Scale points around a centre point
 */
export const scalePoints = (
  points: Node[],
  scaleFactor: number,
  centreX: number,
  centreY: number
): Node[] => {
  return points.map(point => ({
    ...point,
    x: centreX + (point.x - centreX) * scaleFactor,
    y: centreY + (point.y - centreY) * scaleFactor
  }))
}

/**
 * Scale points on X-axis only around a centre point
 */
export const scalePointsX = (
  points: Node[],
  scaleFactor: number,
  centreX: number
): Node[] => {
  return points.map(point => ({
    ...point,
    x: centreX + (point.x - centreX) * scaleFactor
  }))
}

/**
 * Scale points on Y-axis only around a centre point
 */
export const scalePointsY = (
  points: Node[],
  scaleFactor: number,
  centreY: number
): Node[] => {
  return points.map(point => ({
    ...point,
    y: centreY + (point.y - centreY) * scaleFactor
  }))
}

/**
 * Rotate points around a centre point
 */
export const rotatePoints = (
  points: Node[],
  angleDegrees: number,
  centreX: number,
  centreY: number
): Node[] => {
  const angleRadians = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  
  return points.map(point => {
    const dx = point.x - centreX
    const dy = point.y - centreY
    
    return {
      ...point,
      x: centreX + dx * cos - dy * sin,
      y: centreY + dx * sin + dy * cos
    }
  })
}

/**
 * Translate (move) points by a delta
 */
export const translatePoints = (
  points: Node[],
  deltaX: number,
  deltaY: number
): Node[] => {
  return points.map(point => ({
    ...point,
    x: point.x + deltaX,
    y: point.y + deltaY
  }))
}

/**
 * Flip points horizontally around a centre point
 */
export const flipPointsHorizontal = (
  points: Node[],
  centreX: number
): Node[] => {
  return points.map(point => ({
    ...point,
    x: centreX - (point.x - centreX)
  }))
}

/**
 * Flip points vertically around a centre point
 */
export const flipPointsVertical = (
  points: Node[],
  centreY: number
): Node[] => {
  return points.map(point => ({
    ...point,
    y: centreY - (point.y - centreY)
  }))
}

/**
 * Clamp a value between 0 and 1
 */
export const clamp = (value: number): number => {
  return Math.max(0, Math.min(1, value))
}

/**
 * Apply transformations with bounds checking
 */
export const applyTransformation = (
  points: Node[],
  transformFn: (points: Node[]) => Node[]
): Node[] => {
  const transformed = transformFn(points)
  
  // Clamp coordinates to ensure they stay within bounds
  return transformed.map(point => ({
    ...point,
    x: clamp(point.x),
    y: clamp(point.y)
  }))
} 