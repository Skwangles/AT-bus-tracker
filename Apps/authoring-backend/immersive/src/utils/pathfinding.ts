import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"





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


export const buildCalcPath = (currentId, setHighlightedPath, setLastNavigatedToPoint) => {
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
        setHighlightedPath(response.data?.path)
        toast.success(
          `Path to Floor: ${selectedLocation} is now highlighted, follow the blue dots...`
        )
        setLastNavigatedToPoint(selectedLocation)
      }
    } catch (error) {
      toast.error('Could not calculate a path, please try again later')
    }
  }
}