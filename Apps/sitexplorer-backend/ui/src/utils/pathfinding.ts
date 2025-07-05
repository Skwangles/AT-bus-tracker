import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"
import { t } from "i18next"


export const updatePath = (pathfindMode, currentId, highlightedPath, setHighlightedPath, setPathIndex, destinationName,  onArrival) => {
  console.log('updatePath', highlightedPath)
  if (pathfindMode && highlightedPath.includes(Number(currentId))) {
    // Remove points earlier on in the path than the current point
    const indexOfCurrentId = highlightedPath.indexOf(Number(currentId))
    setPathIndex(indexOfCurrentId)
    if (indexOfCurrentId === highlightedPath.length - 1) {
      // We've reached the destination! Clear the path and show arrival animation
      setHighlightedPath([])
      if (onArrival && destinationName) {
        onArrival(destinationName)
      }
      return
    }
  }
}

export async function generatePath(currentId, destinationLocation) {
  const response = await axios.get(
    `${API_PREFIX}/api/v1/point/${currentId}/path/${destinationLocation}`
  )
  if (!response.data || !response.data.path) {
    return null
  }
  else {
    return response.data.path
  }
}

export const createNewPath = async (currentId: number, selectedLocation: string, setHighlightedPath: (path: number[]) => void, setPathIndex: (index: number) => void, setDestinationName: (name: string) => void, displayLabel?: string) => {
  if (!selectedLocation || selectedLocation.length === 0) {
    // Clear the path/show all points
    setPathIndex(-1)
    setDestinationName('')
    setHighlightedPath([])
    return
  }
  
  const path = await generatePath(currentId, selectedLocation)
  if (path) {
    setHighlightedPath(path)
    setPathIndex(0)
    setDestinationName(displayLabel || selectedLocation)
    toast.success(
      t('pathfinding.success', 'Path to {{location}} is now highlighted, follow the blue dots...', { location: displayLabel || selectedLocation })
    )
  }
  else {
    toast.error(t('pathfinding.error', 'Could not calculate a path, please try again later'))
    setPathIndex(-1)
    setDestinationName('')
    setHighlightedPath([])
  }
}

// // Helper function to find the furthest visible point in the path
// const findFurthestVisiblePoint = (path: number[], camera: THREE.Camera, hotspots: HotspotObj[]): HotspotObj | undefined => {
//   const cameraPosition = camera.position
//   const cameraDirection = new THREE.Vector3()
//   camera.getWorldDirection(cameraDirection)

//   let furthestPoint: HotspotObj | undefined = undefined
//   let maxDistance = 0

//   for (const pointId of path) {
//     const point = hotspots.find(h => Number(h.id) === pointId)
//     if (point) {
//       const pointPosition = new THREE.Vector3(...point.position)
//       const distance = cameraPosition.distanceTo(pointPosition)
      
//       // Check if point is in view
//       const angle = cameraDirection.angleTo(
//         pointPosition.clone().sub(cameraPosition).normalize()
//       )
      
//       if (angle < Math.PI / 2 && distance > maxDistance) {
//         maxDistance = distance
//         furthestPoint = point
//       }
//     }
//   }

//   return furthestPoint
// }

// // Helper function to make camera look at a point
// const lookAtPoint = (point: HotspotObj, camera: THREE.Camera) => {
//   const pointPosition = new THREE.Vector3(...point.position)
//   const lookAtPosition = pointPosition.clone()
//   lookAtPosition.y = camera.position.y // Keep camera level
  
//   camera.lookAt(lookAtPosition)
// }