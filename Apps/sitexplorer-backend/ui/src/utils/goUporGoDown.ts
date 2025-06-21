import axios from "axios"
import { toast } from "react-toastify"
import { API_PREFIX } from "../consts"
import { getLevelUpOrDown } from "./floorUpOrDownStrategies"

export const updateMovementAbilities = (setCanGoUp, setCanGoDown, allSearchableLocations, locationGroup) => {
  setCanGoUp(
    !!getLevelUpOrDown(
      allSearchableLocations.map((v) => v.query),
      locationGroup,
      true
    )
  )
  setCanGoDown(
    !!getLevelUpOrDown(
      allSearchableLocations.map((v) => v.query),
      locationGroup,
      false
    )
  )
}

export const getChangeLevelUpOrDown = (allSearchableLocations, changeLocation) => {
  return (location: string, isUp: boolean) => {
    const newLocation = getLevelUpOrDown(
      allSearchableLocations.map((v) => v.query),
      location,
      isUp
    )
    if (!newLocation) {
      toast.warn(
        'Cannot change level - No level is ' + (isUp ? 'above' : 'below')
      )
      return
    }

    if (allSearchableLocations.map((v) => v.query).includes(newLocation)) {
      changeLocation(newLocation)
    }
  }
}

export const getChangeLocation = (currentId, setCurrentId) => {
  return (requestedLocation: string) => {
    axios
      .get<{ keyframe_id: number }>(
        `${API_PREFIX}/api/v1/locationgroup/${requestedLocation}/point`
      )
      .then((value) => {
        const result = value.data.keyframe_id
        if (isNaN(Number(result))) return
        setCurrentId(Number(result).toString())
      })
      .catch((reason) => {
        toast.warn(requestedLocation + ' is not a reachable location.')

        // In the case the 'DEFAULT LOCATION' is not found, we will fetch the first point
        if (Number(currentId) === -1) {
          axios.get<number>(`${API_PREFIX}/api/v1/point`).then((value) => {
            setCurrentId(value.data.toString())
          })
        }
      })
  }
}