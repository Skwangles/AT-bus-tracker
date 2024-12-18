import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import axios from 'axios'
import { API_PREFIX } from '../consts'
import { getPositionOfNode, getYRotation } from '../utils'
import SphereWithHotspots from './SphereWithHotspots'
import { HotspotObj } from './Hotspots'
import { PointData } from './VirtualTour'

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
  currentPoint,
  setCurrentPoint,
  neighbours,
  setNeighbours,
  isRefined,
  highlightedPath,
  setReferenceNode,
}) => {
  const [hotspots, setHotspots] = useState<HotspotObj[]>([])
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(
    new THREE.Vector3()
  )
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0])

  const { camera } = useThree()

  const calcAngleToTarget = (target: { x: number; z: number }) => {
    const yaw = Math.atan2(
      target.x - camera.position.x,
      target.z - camera.position.z
    )
    const yawDownNegativeZAxis = Math.PI - yaw

    // RotationController Euler uses Yaw in CCW
    const yawCCW = -yawDownNegativeZAxis

    return yawCCW % (2 * Math.PI)
  }

  const calculateReferenceNode = (
    pointData: PointData,
    neighboursData: NeighbourData[]
  ) => {
    if (
      neighboursData.length === 1 &&
      Number(neighboursData[0].keyframe_id) === Number(pointData.keyframe_id)
    )
      return 0 // Need 2 nodes to calculate an angle
    if (neighboursData.length === 0 || neighboursData.length === 1) return null

    // Get random/reference node that the Map.tsx floor will share - e.g. First or Last in array
    let referenceNeighbour: NeighbourData
    if (
      Number(pointData.keyframe_id) === Number(neighboursData[0].keyframe_id)
    ) {
      referenceNeighbour = neighboursData[neighboursData.length - 1]
    } else {
      referenceNeighbour = neighboursData[0]
    }

    const neighbourPos = getPositionOfNode(referenceNeighbour)
    const neighbourVec = new THREE.Vector3(
      neighbourPos[0],
      neighbourPos[1],
      neighbourPos[2]
    )

    return {
      id: referenceNeighbour.keyframe_id,
      targetYaw: calcAngleToTarget(neighbourVec),
    }
  }

  const fetchPointData = async (pointId: string) => {
    try {
      const pointResponse = await axios.get<PointData>(
        `${API_PREFIX}/api/v1/point/${pointId}`
      )
      const pointData = pointResponse.data
      console.info('Point Data', pointData)

      const neighboursResponse = await axios.get<NeighbourData[]>(
        `${API_PREFIX}/api/v1/point/${pointId}/neighbours/8/6`
      )

      const neighboursData = neighboursResponse.data

      const referenceNode = calculateReferenceNode(pointData, neighboursData)
      if (referenceNode) {
        setReferenceNode(referenceNode)
      }

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

export default Canvas
