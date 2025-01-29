import * as THREE from 'three'
import { useRef, useState } from 'react'
import {
  COORDS_TO_METRES_FOR_SPHERES,
  HOTSPOT_COLOUR,
  HOTSPOT_HIGHLIGHTED,
  HOTSPOT_OUTLINE,
  USE_GLB_MARKER_OBJECT,
} from '../../consts'
import Model from './Model'
import { useFrame } from '@react-three/fiber'

// Utility function to detect mobile devices
const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

interface HotspotProps {
  position: [number, number, number]
  rotation: [number, number, number]
  image_identifier: string
  onClick: () => void
  isHighlighted: boolean
  isEnd: boolean
}

export interface HotspotObj {
  pose: THREE.Matrix4
  position: [number, number, number]
  rotation: [number, number, number]
  id: string
  ts: string
}

const Hotspot: React.FC<HotspotProps> = ({
  position,
  onClick,
  rotation,
  image_identifier,
  isHighlighted,
  isEnd,
}) => {
  // Increase size for mobile
  const sizeMultiplier = isMobile() ? 1.5 : 1
  const sphereSize = (20 / COORDS_TO_METRES_FOR_SPHERES) * sizeMultiplier
  const outlineSize = sphereSize * 1.09
  const dropHotspotsBelowEyeLevelOffset = 8 / COORDS_TO_METRES_FOR_SPHERES

  position[1] -= COORDS_TO_METRES_FOR_SPHERES * dropHotspotsBelowEyeLevelOffset

  const endRef = useRef<any>(null)
  const outlineEndRef = useRef<any>(null)

  // State to track hover
  const [isHovered, setIsHovered] = useState(false)

  useFrame((state, delta) => {
    if (
      isEnd &&
      endRef.current &&
      endRef.current.rotation &&
      outlineEndRef.current &&
      outlineEndRef.current.rotation
    ) {
      endRef.current.rotation.x += delta
      outlineEndRef.current.rotation.x += delta
    }
  })

  if (USE_GLB_MARKER_OBJECT && isEnd) {
    return <Model position={position} onClick={onClick} />
  }

  return (
    <>
      <mesh
        position={position}
        rotation={rotation}
        ref={endRef}
        onClick={onClick}
        onPointerOver={() => setIsHovered(true)}
        onPointerOut={() => setIsHovered(false)}
        receiveShadow
      >
        {isEnd ? (
          <boxGeometry
            args={[sphereSize * 3, sphereSize * 3, sphereSize * 3]}
          />
        ) : (
          <sphereGeometry args={[sphereSize, 20, 20]} />
        )}
        <meshStandardMaterial
          color={
            isHovered
              ? HOTSPOT_HIGHLIGHTED
              : isEnd
              ? '#FFFF00'
              : isHighlighted
              ? HOTSPOT_HIGHLIGHTED
              : HOTSPOT_COLOUR
          }
        />
      </mesh>
      <mesh
        position={position}
        rotation={rotation}
        ref={outlineEndRef}
        onClick={onClick}
      >
        {isEnd ? (
          <boxGeometry
            args={[outlineSize * 3, outlineSize * 3, outlineSize * 3]}
          />
        ) : (
          <sphereGeometry args={[outlineSize, 20, 20]} />
        )}
        <meshBasicMaterial color={HOTSPOT_OUTLINE} side={THREE.BackSide} />
      </mesh>
    </>
  )
}

export default Hotspot
