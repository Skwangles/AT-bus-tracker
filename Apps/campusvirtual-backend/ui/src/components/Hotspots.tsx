import * as THREE from 'three'
import { useRef } from 'react'
import {
  COORDS_TO_METRES,
  HOTSPOT_COLOUR,
  HOTSPOT_HIGHLIGHTED,
  HOTSPOT_OUTLINE,
  USE_GLB_MARKER_OBJECT,
} from '../consts'
import Model from './Model'
import { useFrame } from '@react-three/fiber'

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
  const sphereSize = 20 / COORDS_TO_METRES
  const outlineSize = sphereSize * 1.09
  const dropHotspotsBelowEyeLevelOffset = 8 / COORDS_TO_METRES

  position[1] -= COORDS_TO_METRES * dropHotspotsBelowEyeLevelOffset

  const endRef = useRef<any>(null)
  const outlineEndRef = useRef<any>(null)

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
            isEnd
              ? '#FFFF00'
              : isHighlighted
              ? HOTSPOT_HIGHLIGHTED
              : HOTSPOT_COLOUR
          }
        />
      </mesh>
      ;
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
