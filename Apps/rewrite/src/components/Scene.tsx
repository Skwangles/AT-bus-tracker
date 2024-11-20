import { useEffect, useRef } from 'react'
import 'aframe'
import { useTourStore } from '../store'

export const Scene = () => {
  const sceneRef = useRef<any>(null)
  const { currentNode, getNeighbors, pathNodes } = useTourStore()

  useEffect(() => {
    if (!currentNode) return

    const neighbors = getNeighbors(currentNode.id)

    // Calculate relative positions
    const positions = neighbors.map((neighbor) => ({
      x: neighbor.x - currentNode.x,
      y: neighbor.y - currentNode.y,
      z: neighbor.z - currentNode.z,
      isPath: pathNodes.some((n) => n.id === neighbor.id),
    }))

    // Update marker positions
    positions.forEach((position, index) => {
      const marker = document.createElement('a-sphere')
      marker.setAttribute('position', position)
      marker.setAttribute('radius', '0.2')
      marker.setAttribute('color', position.isPath ? '#ff9900' : '#00ff00')
      marker.setAttribute('class', 'clickable')
      marker.setAttribute('data-node-id', neighbors[index].id.toString())

      marker.addEventListener('click', () => {
        useTourStore.getState().setCurrentNode(neighbors[index].id)
      })

      sceneRef.current?.appendChild(marker)
    })

    return () => {
      const markers = document.querySelectorAll('.clickable')
      markers.forEach((marker) => marker.remove())
    }
  }, [currentNode, pathNodes])

  if (!currentNode) return null

  return (
    <a-scene ref={sceneRef} embedded>
      <a-sky src={currentNode.imageUrl} rotation="0 -90 0" />
      <a-camera
        position="0 1.6 0"
        look-controls="enabled: true"
        wasd-controls="enabled: false"
      >
        <a-cursor color="#FFFFFF" />
      </a-camera>
    </a-scene>
  )
}
