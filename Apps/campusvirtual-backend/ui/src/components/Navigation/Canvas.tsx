import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import axios from 'axios'
import { API_PREFIX } from '../../consts'
import { getPositionOfNode, getYRotation } from '../../utils/utils'
import SphereWithHotspots from './SphereWithHotspots'
import { HotspotObj } from './Hotspots'
import { PointData } from '../VirtualTour'
import { toast } from 'react-toastify'

export interface NeighbourData {
  pose: number[]
  ts: string
  keyframe_id: string
  x_trans: number
  y_trans: number
  z_trans: number
}

const Canvas: React.FC<any> = ({
  currentId,
  setCurrentId,
  setCurrentPoint,
  isPathfindingMode,
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
        `${API_PREFIX}/api/v1/point/${pointId}`
      )
      const pointData = pointResponse.data

      const neighboursResponse = await axios.get<NeighbourData[]>(
        `${API_PREFIX}/api/v1/point/${pointId}/neighbours/8/2`
      )

      const neighboursData = neighboursResponse.data

      setCurrentPoint(pointData)
      setCurrentImage(Number(pointData.ts).toFixed(5))

      setHotspots(
        neighboursData.map((neighbour) => {
          const pos = getPositionOfNode(neighbour)
          const m = new THREE.Matrix4()

          //@ts-expect-error - neighbour.pose is in the right format
          m.set(...neighbour.pose)

          return {
            position: [pos[0], pos[1], pos[2]],
            rotation: [0, getYRotation(neighbour.pose), 0],
            pose: m,
            id: neighbour.keyframe_id,
            ts: neighbour.ts,
          }
        })
      )

      const newPosition = getPositionOfNode(pointData)
      setCurrentPosition(new THREE.Vector3(...newPosition))
      camera.position.set(newPosition[0], newPosition[1], newPosition[2])

      const newRotation = getYRotation(pointData.pose)
      setRotation([0, newRotation, 0])
    } catch (error) {
      toast.error('Could not find point')
    }
  }

  useEffect(() => {
    fetchPointData(currentId)
  }, [currentId, isPathfindingMode]) // pathfinding mode deletes non-path points, so need to refetch

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
      isPathfindingMode={isPathfindingMode}
      highlightedOrbs={highlightedPath}
    />
  ) : (
    <></>
  )
}

export default Canvas
