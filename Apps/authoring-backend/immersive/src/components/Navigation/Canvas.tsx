import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import Scene from './Scene'
import { ThreeNumbersArray, type HotspotObj, type PointData } from '../../types'
import { fetchPointData } from '../../utils/updatePoint'

interface CanvasProps {
  hotspots: HotspotObj[]
  setHotspots: React.Dispatch<React.SetStateAction<HotspotObj[]>>
  currentId: string
  setCurrentId: React.Dispatch<React.SetStateAction<string>>
  setCurrentPoint: React.Dispatch<React.SetStateAction<PointData>>
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  isLoading: boolean
  isPathfindingMode: boolean
  highlightedPath: number[]
  // New props for point creation
  isCreatingPoint?: boolean
  newPointPosition?: ThreeNumbersArray
  onNewPointPositionChange?: (position: ThreeNumbersArray) => void
}

const Canvas: React.FC<CanvasProps> = ({
  hotspots,
  setHotspots,
  currentId,
  setCurrentId,
  setCurrentPoint,
  setIsLoading,
  isLoading,
  isPathfindingMode,
  highlightedPath,
  isCreatingPoint = false,
  newPointPosition = [0, 0, 0],
  onNewPointPositionChange = () => {},
}) => {
  const [currentImage, setCurrentImage] = useState<string>('')
  const currentPosition = useRef<THREE.Vector3>(new THREE.Vector3())
  const imageRotation = useRef<ThreeNumbersArray>([0, 0, 0])

  useEffect(() => {
    fetchPointData(
      currentId,
      setCurrentPoint,
      setCurrentImage,
      setHotspots,
      currentPosition,
      imageRotation
    )
  }, [currentId, isPathfindingMode]) // pathfinding mode deletes non-path points, so need to refetch

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id)
  }

  return currentImage ? (
    <Scene
      position={currentPosition}
      textureUrl={currentImage}
      hotspots={hotspots}
      onHotspotClick={handleHotspotClick}
      imageRotation={imageRotation}
      setIsLoading={setIsLoading}
      isPathfindingMode={isPathfindingMode}
      highlightedOrbs={highlightedPath}
      isCreatingPoint={isCreatingPoint}
      newPointPosition={newPointPosition}
      onNewPointPositionChange={onNewPointPositionChange}
    />
  ) : (
    <></>
  )
}

export default Canvas
