import { FLOOR_ORDERING_STRATEGY, WAIKATO_UNI_LEVELS_ORDER } from "../consts"

type returnType = string | false

const getStrategy = (): ((...args) => returnType) => {
  if (FLOOR_ORDERING_STRATEGY == 'tga') {
    return tga_getFloorUpOrDown
  }
  if (FLOOR_ORDERING_STRATEGY == 'waikato') {
    return waikato_getFloorUpOrDown
  }
  return () => { return false }
}

export const getFloorUpOrDown = (allFloorNames: string[], floor: string, isUp = true): returnType => {
  return getStrategy()(allFloorNames, floor, isUp)
}

const tga_getFloorUpOrDown = (allFloorNames: string[], floor: string, isUp = true): returnType => {
  if (!floor) return false;
  if (floor.includes('.')) {
    return false
  }

  let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(floor)
  if (idx == -1) return false;

  if (isUp) {
    idx += 1
    while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
      if (allFloorNames.includes(WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx += 1
    }
  } else {
    idx -= 1
    while (idx >= 0) {
      if (allFloorNames.includes(WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx -= 1
    }
  }
  return false
}


const waikato_getFloorUpOrDown = (allFloorNames: string[], floor: string, isUp = true): returnType => {
  if (!floor) return false;
  if (!floor.includes('.')) return false;


  const splitName = floor.split('.')
  if (splitName.length == 0 || splitName.length > 2) {
    return false
  }

  let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(splitName[1])
  if (idx == -1) return false

  if (isUp) {
    idx += 1
    while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
      if (allFloorNames.includes(splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx += 1
    }
  } else {
    idx -= 1
    while (idx >= 0) {
      if (allFloorNames.includes(splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx -= 1
    }
  }
  return false
}