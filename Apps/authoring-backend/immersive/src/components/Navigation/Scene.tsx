import * as THREE from 'three'
import { useEffect, useState, useRef } from 'react'
import { API_PREFIX, HIDE_POINTS_DURING_HIGHLIGHT } from '../../consts'
import { HotspotObj, ThreeNumbersArray } from '../../types'
import Hotspot from './Hotspots'
import { toast } from 'react-toastify'
import { getPointAsImageNumber } from '../../utils/utils'
import { useFrame, useThree } from '@react-three/fiber'
import { lerp } from 'three/src/math/MathUtils.js'
import EditablePointPreview from './EditablePointPreview'

interface SphereWithHotspotsProps {
  position: React.MutableRefObject<THREE.Vector3>
  textureUrl: string
  hotspots: HotspotObj[]
  onHotspotClick: (hotspot: HotspotObj) => void
  imageRotation: React.MutableRefObject<ThreeNumbersArray>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  highlightedOrbs: number[]
  isPathfindingMode: boolean
  // New props for point creation
  isCreatingPoint?: boolean
  newPointPosition?: ThreeNumbersArray
  onNewPointPositionChange?: (position: ThreeNumbersArray) => void
}

// Define resolution levels
const RESOLUTION_LEVELS = [
  { name: 'preview', delay: 0 }, // 64x32 instant preview
  { name: 'lowest', delay: 100 }, // 256x128
  { name: 'low', delay: 300 }, // 512x256
  { name: 'medium', delay: 800 }, // 1024x512
  { name: 'high', delay: 1500 }, // 2048x1024
  { name: 'ultra', delay: 2500 }, // 4096x2048
]

const Scene: React.FC<SphereWithHotspotsProps> = ({
  position,
  textureUrl,
  hotspots,
  onHotspotClick,
  imageRotation,
  isPathfindingMode,
  setIsLoading,
  highlightedOrbs,
  isCreatingPoint = false,
  newPointPosition = [0, 0, 0],
  onNewPointPositionChange = () => {},
}) => {
  const [currentTexture, setCurrentTexture] = useState<THREE.Texture>(
    new THREE.Texture()
  )
  const { camera } = useThree()
  const [previousTexture, setPreviousTexture] = useState<THREE.Texture | null>(
    null
  )

  const showPrevious = useRef(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const previousImgMeshRef = useRef<THREE.MeshBasicMaterial>(null)
  const currentImgMeshRef = useRef<THREE.MeshBasicMaterial>(null)

  const currentTextureUrlRef = useRef(textureUrl)
  const loadingQueue = useRef<NodeJS.Timeout[]>([])

  const calculateShownHotspots = (
    hotspots: HotspotObj[],
    isPathfindingMode: boolean,
    highlightedOrbs: number[]
  ) => {
    return hotspots
      .map((hotspot) => ({
        ...hotspot,
        isHighlighted: highlightedOrbs.includes(Number(hotspot.id)),
        isEnd: isPathfindingMode
          ? highlightedOrbs[highlightedOrbs.length - 1] === Number(hotspot.id)
          : false,
      }))
      .filter((hotspot) =>
        HIDE_POINTS_DURING_HIGHLIGHT && isPathfindingMode
          ? highlightedOrbs.includes(Number(hotspot.id))
          : true
      )
  }

  const [shownHotspots, setShownHotspots] = useState<
    (HotspotObj & { isHighlighted: boolean; isEnd: boolean })[]
  >(calculateShownHotspots(hotspots, isPathfindingMode, highlightedOrbs))
  const previousImageRotation = useRef<ThreeNumbersArray>(imageRotation.current)
  const loadedImageRotation = useRef<ThreeNumbersArray>(imageRotation.current)
  const loadedPosition = useRef<THREE.Vector3>(position.current)

  const loadTextureAtResolution = async (resolution: string, textureUrl) => {
    if (currentTextureUrlRef.current !== textureUrl) return null

    try {
      const texture = await new THREE.TextureLoader().loadAsync(
        `${API_PREFIX}/api/v1/image/${resolution}/${textureUrl}`
      )

      // Only update if we're still on the same image
      if (currentTextureUrlRef.current === textureUrl) {
        return texture
      }
    } catch (err) {
      toast.error('Could not load point image')
    }
    return null
  }

  ///
  /// Point image has updated
  ///
  useEffect(() => {
    console.log('**********Transition start***********')
    setIsTransitioning(true)
    if (currentTexture.image) {
      setPreviousTexture(currentTexture)
      previousImageRotation.current = loadedImageRotation.current
      showPrevious.current = true
    }

    // Clear any pending loads
    loadingQueue.current.forEach((timeout) => clearTimeout(timeout))
    loadingQueue.current = []

    // Update the URL
    currentTextureUrlRef.current = textureUrl

    // Queue up loading of each resolution level
    RESOLUTION_LEVELS.forEach(({ name, delay }) => {
      const timeout = setTimeout(async () => {
        const newTexture = await loadTextureAtResolution(name, textureUrl)
        if (newTexture) {
          setCurrentTexture(newTexture)
          setIsTransitioning(false)
          showPrevious.current = false

          if (delay === 0) {
            console.log('*******Transition end*******')
            // hide loading icon?
          }
        }
      }, delay)
      loadingQueue.current.push(timeout)
    })

    return () => {
      loadingQueue.current.forEach((timeout) => clearTimeout(timeout))
      currentTextureUrlRef.current = ''
    }
  }, [textureUrl])

  // useEffect(() => {
  //   setIsLoading(isImgLoading);
  // }, [isImgLoading, setIsLoading]);

  // Update the points on screen when the first image is loaded or when the pathfinding mode changes
  // Use a state, so it times with the
  useEffect(() => {
    if (isTransitioning) return

    loadedImageRotation.current = imageRotation.current
    loadedPosition.current = position.current
    camera.position.set(
      position.current.x,
      position.current.y,
      position.current.z
    )
  }, [isTransitioning])

  useEffect(() => {
    if (!isTransitioning) {
      setShownHotspots(
        calculateShownHotspots(hotspots, isPathfindingMode, highlightedOrbs)
      )
    }
  }, [isTransitioning, isPathfindingMode, highlightedOrbs])

  useFrame(() => {
    if (
      previousImgMeshRef.current &&
      currentImgMeshRef.current &&
      !showPrevious.current
    ) {
      previousImgMeshRef.current.opacity = lerp(
        previousImgMeshRef.current.opacity,
        0,
        0.1
      )
      // currentImgMeshRef.current.opacity = 1;
    } else if (
      previousImgMeshRef.current &&
      currentImgMeshRef.current &&
      showPrevious.current
    ) {
      previousImgMeshRef.current.opacity = 1
    }
  })

  return (
    <group>
      {/* Previous sphere for smooth transition */}
      {previousTexture && (
        <mesh
          rotation={previousImageRotation.current}
          position={loadedPosition.current}
          scale={[-1, 1, 1]}
        >
          <sphereGeometry args={[995, 64, 64]} />
          <meshBasicMaterial
            ref={previousImgMeshRef}
            map={previousTexture}
            side={THREE.BackSide}
            transparent
          />
        </mesh>
      )}

      {/* Current sphere */}
      <mesh
        rotation={loadedImageRotation.current}
        position={loadedPosition.current}
        scale={[-1, 1, 1]}
      >
        <sphereGeometry args={[1000, 64, 64]} />
        <meshBasicMaterial
          ref={currentImgMeshRef}
          map={currentTexture}
          side={THREE.BackSide}
          transparent
        />
      </mesh>

      {/* Hotspots */}
      {shownHotspots.map((hotspot, index) => (
        <Hotspot
          key={index}
          position={hotspot.position}
          rotation={hotspot.rotation}
          image_identifier={getPointAsImageNumber(hotspot)}
          onClick={() => onHotspotClick(hotspot)}
          isPathfinding={isPathfindingMode}
          isHighlighted={hotspot.isHighlighted}
          isEnd={hotspot.isEnd}
        />
      ))}

      {/* Point creation preview with transform controls */}
      {isCreatingPoint && (
        <EditablePointPreview
          position={newPointPosition}
          onPositionChange={onNewPointPositionChange}
        />
      )}
    </group>
  )
}

export default Scene
