import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"
import { getFloorUpOrDown } from "./floorUpOrDownStrategies"

export const updateMovementAbilities = (setCanGoUp, setCanGoDown, allSearchableLocations, locationGroup) => {
  setCanGoUp(
    !!getFloorUpOrDown(
      allSearchableLocations.map((v) => v.query),
      locationGroup,
      true
    )
  )
  setCanGoDown(
    !!getFloorUpOrDown(
      allSearchableLocations.map((v) => v.query),
      locationGroup,
      false
    )
  )
}

export const getChangeFloorUpOrDown = (allSearchableLocations, changeFloor) => {

  return (floor: string, isUp: boolean) => {
    const newFloor = getFloorUpOrDown(
      allSearchableLocations.map((v) => v.query),
      floor,
      isUp
    )
    if (!newFloor) {
      toast.warn(
        'Cannot change floor - No floor is ' + (isUp ? 'above' : 'below')
      )
      return
    }

    if (allSearchableLocations.map((v) => v.query).includes(newFloor)) {
      changeFloor(newFloor)
    }
  }
}

export const getChangeFloor = (currentId, setCurrentId) => {

  return (requestedFloor: string) => {
    axios
      .get<{ keyframe_id: number }>(
        `${API_PREFIX}/api/v1/floor/${requestedFloor}/point`
      )
      .then((value) => {
        const result = value.data.keyframe_id
        if (isNaN(Number(result))) return
        setCurrentId(Number(result).toString())
      })
      .catch((reason) => {
        toast.warn(requestedFloor + ' is not a reachable location.')

        // In the case the 'DEFAULT FLOOR' is not found, we will fetch the first point
        if (Number(currentId) === -1) {
          axios.get<number>(`${API_PREFIX}/api/v1/point`).then((value) => {
            setCurrentId(value.data.toString())
          })
        }
      })
  }
}