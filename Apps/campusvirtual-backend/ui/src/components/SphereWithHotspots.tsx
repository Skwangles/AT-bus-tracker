import * as THREE from 'three'
import { useEffect, useState } from 'react'
import { API_PREFIX, HIDE_POINTS_DURING_HIGHLIGHT } from '../consts'
import Hotspot, { HotspotObj } from './Hotspots'

interface SphereWithHotspotsProps {
  position: THREE.Vector3
  textureUrl: string
  hotspots: HotspotObj[]
  onHotspotClick: (hotspot: HotspotObj) => void
  rotation: [number, number, number]
  highlightedOrbs: number[]
}

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({
  position,
  textureUrl,
  hotspots,
  onHotspotClick,
  rotation,
  highlightedOrbs,
}) => {
  const [currentTexture, setCurrentTexture] = useState(new THREE.Texture())

  useEffect(() => {
    let hasHigherResAlreadyLoaded = false
    const textureUrlCopy = textureUrl

    // Load low-res and hi-res at same time, but ignore one if already completed.
    new THREE.TextureLoader()
      .loadAsync(`${API_PREFIX}/image/lores/${textureUrl}`)
      .then((texture) => {
        console.log('Logged Texture - lowres:', textureUrlCopy)
        if (!hasHigherResAlreadyLoaded && textureUrl === textureUrlCopy) {
          setCurrentTexture(texture)
        }
      })

    new THREE.TextureLoader()
      .loadAsync(`${API_PREFIX}/image/hires/${textureUrl}`)
      .then((texture) => {
        console.log('Logged Texture - hires:', textureUrlCopy)
        if (textureUrlCopy === textureUrl) {
          hasHigherResAlreadyLoaded = true
          setCurrentTexture(texture)
        }
      })
      .catch((err) => console.log(err))
  }, [textureUrl])

  rotation[1] += Math.PI / 2

  return (
    <group>
      <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 64]} />
        <meshBasicMaterial map={currentTexture} side={THREE.BackSide} />
      </mesh>
      {hotspots
        .filter((hotspot) =>
          HIDE_POINTS_DURING_HIGHLIGHT && highlightedOrbs.length > 0
            ? highlightedOrbs.includes(Number(hotspot.id))
            : true
        )
        .map((hotspot, index) => (
          <Hotspot
            key={index}
            position={hotspot.position}
            rotation={hotspot.rotation}
            image_identifier={Number(hotspot.ts).toFixed(5)}
            onClick={() => onHotspotClick(hotspot)}
            isHighlighted={highlightedOrbs.includes(Number(hotspot.id))}
            isEnd={
              highlightedOrbs.length > 0
                ? highlightedOrbs[highlightedOrbs.length - 1] ===
                  Number(hotspot.id)
                : false
            }
          />
        ))}
    </group>
  )
}

export default SphereWithHotspots
