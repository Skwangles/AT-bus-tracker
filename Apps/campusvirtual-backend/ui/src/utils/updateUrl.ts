let params = new URLSearchParams(window.location.search)


export const initFromParams = () => {

  if (params.has('yaw') || params.has('pitch')) {
    return {
      yaw: Number(params.get('yaw') ?? 0),
      pitch: Number(params.get('pitch') ?? 0),
    }
  }
  return { yaw: 0, pitch: 0 }
}

export const setOnPopstateEvent = (setCurrentId, setCameraRotation, camRotation) => {

  window.onpopstate = (e) => {
    params = new URLSearchParams(window.location.search)
    if (params.has('id')) {
      setCurrentId(params.get('id') ?? '0')
    }

    if (params.has('yaw') || params.has('pitch')) {
      setCameraRotation({
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      })
    }
  }
}

const DEBOUNCE_LENGTH_MS = 500

export const updateParams = (camRotation, setDebounceExpiry, debounceExpiry) => {

  params.set('yaw', Number(camRotation['yaw']).toFixed(4))
  params.set('pitch', Number(camRotation['pitch']).toFixed(4))
  const now = Date.now()
  if (now > debounceExpiry) {
    // Firefox & safari see security issue if this is called too fast
    setDebounceExpiry(now + DEBOUNCE_LENGTH_MS)
    history.replaceState({}, '', '?' + params.toString())
  }
}

export function updateHistory(locationGroup, PROJECT_NAME, currentId) {
  document.title = locationGroup
    ? `${PROJECT_NAME} - ${locationGroup}`
    : PROJECT_NAME
  params.set('id', currentId)
  history.pushState({}, '', '?' + params.toString())
}

export function nullIdValue(currentId) {
  return Number(currentId) === -1 ||
    !params.has('id') ||
    Number(params.get('id')) === -1
}