import { padCordAwayFromEdge } from "./utils"
import { type Node } from "../consts"

export const flipPointsVertically = (nodes: Node[], selectedPoints: any, updateMap: (nodes: Node[]) => void, onlySelected = false) => {
  const newNodes = nodes.map((node) => {
    if (onlySelected && !selectedPoints.has(node.id)) return node
    node.y = padCordAwayFromEdge(1 - node.y)
    return node
  })

  updateMap(newNodes)
}

export const flipPointsHorizontally = (nodes: Node[], selectedPoints: any, updateMap: (nodes: Node[]) => void, onlySelected = false) => {
  const newNodes = nodes.map((node) => {
    if (onlySelected && !selectedPoints.has(node.id)) return node
    node.x = padCordAwayFromEdge(1 - node.x)
    return node
  })

  updateMap(newNodes)
}

export const rotatePoints = (nodes: Node[], selectedPoints: any, updateMap: (nodes: Node[]) => void, onlySelected = false) => {
  const newNodes = nodes.map((node) => {
    if (onlySelected && !selectedPoints.has(node.id)) return node
    const x = node.x
    const y = node.y
    node.x = padCordAwayFromEdge(y)
    node.y = padCordAwayFromEdge(1 - x)
    return node
  })
  updateMap(newNodes)
}


export const moveX = (nodes: Node[], updateMap: (nodes: Node[]) => void, scale: number) => {
  const newNodes = nodes.map((node) => {
    node.x = node.x + scale
    return node
  })
  updateMap(newNodes)
}

export const moveY = (nodes: Node[], updateMap: (nodes: Node[]) => void, scale: number) => {
  const newNodes = nodes.map((node) => {
    node.y = node.y + scale
    return node
  })
  updateMap(newNodes)
}
export const rescaleX = (nodes: Node[], updateMap: (nodes: Node[]) => void, scale: number, originX: number = 0.5) => {
  const newNodes = nodes.map((node) => {
    node.x = (node.x - originX) * scale + originX
    return node
  })
  updateMap(newNodes)
}

export const rescaleY = (nodes: Node[], updateMap: (nodes: Node[]) => void, scale: number, originY: number = 0.5) => {
  const newNodes = nodes.map((node) => {
    node.y = (node.y - originY) * scale + originY
    return node
  })
  updateMap(newNodes)
}

export const rescalePoints = (nodes: Node[], updateMap: (nodes: Node[]) => void,
  scale: number,
  originX: number = 0.5,
  originY: number = 0.5
) => {
  const newNodes = nodes.map((node) => {
    node.x = (node.x - originX) * scale + originX
    node.y = (node.y - originY) * scale + originY
    return node
  })
  updateMap(newNodes)
}

export const rotatePointsByAngle = (
  nodes: Node[],
  selectedPoints: any,
  updateMap: any,
  angle: number,
  oX: number,
  oY: number,
  onlySelected = false
) => {
  const newNodes = nodes.map((node) => {
    if (onlySelected && !selectedPoints.has(node.id)) return node

    const radians = angle * (Math.PI / 180) // Convert angle to radians
    const cosTheta = Math.cos(radians)
    const sinTheta = Math.sin(radians)

    const x = node.x - oX
    const y = node.y - oY

    node.x = padCordAwayFromEdge(x * cosTheta - y * sinTheta + oX)
    node.y = padCordAwayFromEdge(x * sinTheta + y * cosTheta + oY)
    return node
  })
  updateMap(newNodes)
}

