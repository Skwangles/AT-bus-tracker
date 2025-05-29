import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"
import * as THREE from "three"
import { HotspotObj } from "../types"

export const moveForwardOnPath = (pathfindMode, highlightedPath, currentId, setHighlightedPath, lastNavigatedToPoint, calculateHighlightedPath) => {
  if (pathfindMode && highlightedPath.includes(Number(currentId))) {
    // Remove points earlier on in the path than the current point
    setHighlightedPath(
      highlightedPath.indexOf(Number(currentId)) == highlightedPath.length - 1
        ? []
        : highlightedPath.slice(highlightedPath.indexOf(Number(currentId)))
    )
  } else if (pathfindMode && !highlightedPath.includes(Number(currentId))) {
    // Recalculate when the user strays from the path
    calculateHighlightedPath(lastNavigatedToPoint)
  }
}

export const buildCalcPath = (currentId, setHighlightedPath, setLastNavigatedToPoint, camera, hotspots: HotspotObj[]) => {
  return async (selectedLocation: string) => {
    if (!selectedLocation || selectedLocation.length === 0) {
      // Clear the path/show all points
      setHighlightedPath([])
      return
    }

    try {
      const response = await axios.get(
        `${API_PREFIX}/api/v1/point/${currentId}/path/${selectedLocation}`
      )
      if (!response.data || !response.data.path) {
        toast.error('Could not calculate a path, please try again later')
      } else {
        const path = response.data.path
        setHighlightedPath(path)
        toast.success(
          `Path to ${selectedLocation} is now highlighted, follow the blue dots...`
        )
        setLastNavigatedToPoint(selectedLocation)

        // Look at the furthest visible point in the path
        if (camera && path.length > 0) {
          const furthestVisiblePoint = findFurthestVisiblePoint(path, camera, hotspots)
          if (furthestVisiblePoint) {
            lookAtPoint(furthestVisiblePoint, camera)
          }
        }
      }
    } catch (error) {
      toast.error('Could not calculate a path, please try again later')
    }
  }
}

// Helper function to find the furthest visible point in the path
const findFurthestVisiblePoint = (path: number[], camera: THREE.Camera, hotspots: HotspotObj[]): HotspotObj | undefined => {
  const cameraPosition = camera.position
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)

  let furthestPoint: HotspotObj | undefined = undefined
  let maxDistance = 0

  for (const pointId of path) {
    const point = hotspots.find(h => Number(h.id) === pointId)
    if (point) {
      const pointPosition = new THREE.Vector3(...point.position)
      const distance = cameraPosition.distanceTo(pointPosition)
      
      // Check if point is in view
      const angle = cameraDirection.angleTo(
        pointPosition.clone().sub(cameraPosition).normalize()
      )
      
      if (angle < Math.PI / 2 && distance > maxDistance) {
        maxDistance = distance
        furthestPoint = point
      }
    }
  }

  return furthestPoint
}

// Helper function to make camera look at a point
const lookAtPoint = (point: HotspotObj, camera: THREE.Camera) => {
  const pointPosition = new THREE.Vector3(...point.position)
  const lookAtPosition = pointPosition.clone()
  lookAtPosition.y = camera.position.y // Keep camera level
  
  camera.lookAt(lookAtPosition)
}