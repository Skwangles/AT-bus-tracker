import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"
import * as THREE from "three"
import { HotspotObj } from "../types"

export const moveForwardOnPath = (pathfindMode, highlightedPath, currentId, setHighlightedPath, calculateHighlightedPath, destinationName, onArrival) => {
  if (pathfindMode && highlightedPath.includes(Number(currentId))) {
    // Remove points earlier on in the path than the current point
    const indexOfCurrentId = highlightedPath.indexOf(Number(currentId))
    if (indexOfCurrentId === 0) {
      // If already at the start of the path, do nothing
      return
    }
    
    // Check if we've reached the end of the path
    if (indexOfCurrentId === highlightedPath.length - 1) {
      // We've reached the destination! Clear the path and show arrival animation
      setHighlightedPath([])
      if (onArrival && destinationName) {
        onArrival(destinationName)
      }
      return
    }
    
    const newPath = highlightedPath.slice(indexOfCurrentId)
    setHighlightedPath(newPath)
  }
}

export const buildCalcPath = (currentId, setHighlightedPath, camera, hotspots: HotspotObj[], setDestinationName) => {
  // console.log("Building calculate path function")
  return async (selectedLocation: string) => {
    if (!selectedLocation || selectedLocation.length === 0) {
      // Clear the path/show all points
      setHighlightedPath([])
      setDestinationName('')
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
        setDestinationName(selectedLocation)
        toast.success(
          `Path to ${selectedLocation} is now highlighted, follow the blue dots...`
        )

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