import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import axios from 'axios'
import { API_PREFIX } from '../consts'
import { calculatePositionFromMatrix, getYRotation } from '../utils'
import SphereWithHotspots from './SphereWithHotspots'
import { HotspotObj } from './Hotspots'
import { PointData } from './VirtualTour'

interface NeighbourData {
  pose: number[]
  ts: string
  keyframe_id: string
}

const VirtualTourContent: React.FC<any> = ({
  currentId,
  setCurrentId,
  currentPoint,
  setCurrentPoint,
  neighbours,
  setNeighbours,
  isRefined,
  highlightedPath,
}) => {
  const [hotspots, setHotspots] = useState<HotspotObj[]>([])
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(
    new THREE.Vector3()
  )
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0])

  const { camera } = useThree()

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(
        `${API_PREFIX}/point/${pointId}/true`
      )
      const pointData = pointResponse.data
      console.info('Point Data', pointData)

      const neighboursResponse = await axios.get<NeighbourData[]>(
        `${API_PREFIX}/point/${pointId}/neighbours/${Boolean(isRefined)}/8/6`
      )

      const neighboursData = neighboursResponse.data

      setCurrentPoint(pointData)
      setCurrentImage(Number(pointData.ts).toFixed(5))

      setHotspots(
        neighboursData.map((neighbour) => {
          const pos = calculatePositionFromMatrix(neighbour.pose)
          const m = new THREE.Matrix4()

          //@ts-expect-error - neighbour.pose is in the right format
          m.set(...neighbour.pose)

          return {
            position: pos,
            rotation: [0, getYRotation(neighbour.pose), 0],
            pose: m,
            id: neighbour.keyframe_id,
            ts: neighbour.ts,
          }
        })
      )

      const newPosition = calculatePositionFromMatrix(pointData.pose)
      setCurrentPosition(new THREE.Vector3(...newPosition))
      camera.position.set(newPosition[0], newPosition[1], newPosition[2])

      const newRotation = getYRotation(pointData.pose)
      setRotation([0, newRotation, 0])
    } catch (error) {
      console.error('Error fetching point data:', error)
    }
  }

  useEffect(() => {
    fetchPointData(currentId)
  }, [currentId])

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id)
  }

  return currentImage ? (
    <SphereWithHotspots
      position={currentPosition}
      textureUrl={currentImage}
      hotspots={hotspots}
      onHotspotClick={handleHotspotClick}
      rotation={rotation}
      highlightedOrbs={highlightedPath}
    />
  ) : (
    <></>
  )
}

export default VirtualTourContent
