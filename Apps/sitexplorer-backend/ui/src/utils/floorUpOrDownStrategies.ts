import { FLOOR_ORDERING_STRATEGY, WAIKATO_UNI_LEVELS_ORDER } from "../consts"

type returnType = string | false

const getStrategy = (): ((...args) => returnType) => {
  if (FLOOR_ORDERING_STRATEGY == 'tga') {
    return tga_getLevelUpOrDown
  }
  if (FLOOR_ORDERING_STRATEGY == 'waikato') {
    return waikato_getLevelUpOrDown
  }
  return () => { return false }
}

export const getLevelUpOrDown = (allLocationNames: string[], location: string, isUp = true): returnType => {
  return getStrategy()(allLocationNames, location, isUp)
}

const tga_getLevelUpOrDown = (allLocationNames: string[], location: string, isUp = true): returnType => {
  if (!location) return false;
  if (location.includes('.')) {
    return false
  }

  let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(location)
  if (idx == -1) return false;

  if (isUp) {
    idx += 1
    while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
      if (allLocationNames.includes(WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx += 1
    }
  } else {
    idx -= 1
    while (idx >= 0) {
      if (allLocationNames.includes(WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx -= 1
    }
  }
  return false
}

const waikato_getLevelUpOrDown = (allLocationNames: string[], location: string, isUp = true): returnType => {
  if (!location) return false;
  if (!location.includes('.')) return false;

  const splitName = location.split('.')
  if (splitName.length == 0 || splitName.length > 2) {
    return false
  }

  let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(splitName[1])
  if (idx == -1) return false

  if (isUp) {
    idx += 1
    while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
      if (allLocationNames.includes(splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx += 1
    }
  } else {
    idx -= 1
    while (idx >= 0) {
      if (allLocationNames.includes(splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx])) {
        return splitName[0] + "." + WAIKATO_UNI_LEVELS_ORDER[idx]
      }
      idx -= 1
    }
  }
  return false
}