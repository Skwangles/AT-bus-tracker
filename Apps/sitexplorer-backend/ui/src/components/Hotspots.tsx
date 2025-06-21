import { useFrame } from "@react-three/fiber"
import { useState } from "react"
import { HotspotObj } from "../types"
import * as THREE from "three"
import Hotspot from "./Navigation/Hotspots"

interface HotspotsProps {
  hotspots: HotspotObj[]
  highlightedPath: number[]
  camera: THREE.Camera
  onHotspotClick: (id: string) => void
}

export const Hotspots = ({ hotspots, highlightedPath, camera, onHotspotClick }: HotspotsProps) => {
  const [visibleHotspots, setVisibleHotspots] = useState<HotspotObj[]>([])

  useFrame(() => {
    if (!camera) return

    const cameraPosition = camera.position
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)

    const visible = hotspots.filter(hotspot => {
      // If not in pathfinding mode, show all hotspots
      if (highlightedPath.length === 0) return true

      // If in pathfinding mode, only show hotspots in the path
      const isInPath = highlightedPath.includes(Number(hotspot.id))
      if (!isInPath) return false

      // Check if hotspot is in view
      const pointPosition = new THREE.Vector3(...hotspot.position)
      const angle = cameraDirection.angleTo(
        pointPosition.clone().sub(cameraPosition).normalize()
      )
      return angle < Math.PI / 2
    })

    setVisibleHotspots(visible)
  })

  return (
    <>
      {visibleHotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          position={hotspot.position}
          rotation={hotspot.rotation}
          image_identifier={hotspot.id}
          onClick={() => onHotspotClick(hotspot.id)}
          isHighlighted={highlightedPath.includes(Number(hotspot.id))}
          isPathfinding={highlightedPath.length > 0}
          isEnd={false}
        />
      ))}
    </>
  )
} 