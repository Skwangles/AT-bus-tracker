import React, { useEffect, useState, useRef } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { SHOW_NAV_SEARCH, WAIKATO_UNI_LEVELS_ORDER } from '../consts'
import { API_PREFIX, showMap, PROJECT_NAME } from '../consts'
import axios from 'axios'
import CameraRotationControls from './RotationController'
import Instructions from './Instructions'
import Map from './Map'
import SearchBar from './SearchBar'
import { toast, ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import { MapPin, ChevronUp, Map as FeatherMap, Info } from 'react-feather'
import LocationChangeControls from './LocationChangeControls'
import Canvas, { NeighbourData } from './Canvas'
import { DesktopLayout } from './DesktopLayout'
import { MobileLayout } from './MobileLayout'
export interface PointData {
  pose: number[]
  ts: string
  keyframe_id: number
  x_trans: number
  y_trans: number
  z_trans: number
  location: string
}

const VirtualTour: React.FC = () => {
  let params = new URLSearchParams(window.location.search)

  const [currentId, setCurrentId] = useState<string>(() => {
    if (params.has('id')) {
      return params.get('id') ?? '-1'
    }
    return '-1'
  })

  const [currentPoint, setCurrentPoint] = useState<PointData>({
    pose: [],
    ts: '',
    keyframe_id: -1,
    location: '',
    z_trans: 0,
    x_trans: 0,
    y_trans: 0,
  })

  const [floorWideNeighbours, setFloorWideNeighbours] = useState<
    NeighbourData[]
  >([])
  const [locationGroup, setLocationGroup] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allFloorNames, setAllFloorNames] = useState<string[]>([])
  
  const [isInstructionsOpen, setInstructionsOpen] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)
  const [firstLoad, setFirstLoad] = useState(false)

  const [camRotation, setCameraRotation] = useState<{
    yaw: number
    pitch: number
  }>(() => {
    if (params.has('yaw') || params.has('pitch')) {
      return {
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      }
    }
    return { yaw: 0, pitch: 0 }
  })

  const changeFloor = (requestedFloor: string) => {
    console.log('Fetching', requestedFloor)

    axios
      .get<{ keyframe_id: number }>(
        API_PREFIX + '/api/v1/floor/' + requestedFloor + '/point'
      )
      .then((value) => {
        console.log(value.data)
        const result = value.data.keyframe_id
        if (isNaN(Number(result))) return
        console.log('Setting ID to ', result)
        setCurrentId(Number(result).toString())
      })
      .catch((reason) =>
        console.error('Floor could not be found: ' + reason.toString())
      )
  }

  useEffect(() => {
    // RUN ON FIRST LOAD
    axios
      .get<{ location: string }[]>(API_PREFIX + '/api/v1/floors')
      .then((result) => {
        console.log('Floors', result.data)
        setAllFloorNames(result.data.map((val) => String(val.location)))
      })

    if (currentId == '-1' || !params.has('id') || params.get('id') == '-1') {
      changeFloor('indoors')
    }
  }, [])

  useEffect(() => {
    document.title = locationGroup
      ? PROJECT_NAME + ' - ' + locationGroup
      : PROJECT_NAME
    params.set('id', currentId)
    history.pushState({}, '', '?' + params.toString())
  }, [
    currentId,
    locationGroup /* DO NOT INCLUDE 'params' otherwise any yaw/pitch change will trigger it */,
  ])

  useEffect(() => {
    params.set('yaw', Number(camRotation['yaw']).toFixed(4))
    params.set('pitch', Number(camRotation['pitch']).toFixed(4))
    history.replaceState({}, '', '?' + params.toString())
  }, [camRotation])

  useEffect(() => {
    console.log('Location:', currentPoint.location)
    setLocationGroup(currentPoint.location)
  }, [currentPoint])

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

  const calculateHighlightedPath = async (selectedLocation: string) => {
    try {
      const response = await axios.get(
        `${API_PREFIX}/api/v1/point/${currentId}/path/${selectedLocation}`
      )
      console.log('API Response:', response.data)
      if (!response.data || !response.data.path) {
        toast.error('Something went wrong calculating a path!')
      } else {
        setHighlightedPath(response.data?.path)
        toast.success(
          `Path to Floor: ${selectedLocation} is now highlighted, follow the blue dots...`
        )
      }
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Something went wrong fetching the path, try again later!')
    }
  }

  useEffect(() => {
    if (
      highlightedPath.length > 0 &&
      highlightedPath.includes(Number(currentId))
    ) {
      setHighlightedPath(
        highlightedPath.indexOf(Number(currentId)) == highlightedPath.length - 1
          ? []
          : highlightedPath.slice(highlightedPath.indexOf(Number(currentId)))
      )
    }
  }, [currentId])

  const getFloorUpOrDown = (floor: string, isUp = true) => {
    if (!floor.includes('.')) return false
    const splitName = floor.split('.')
    if (splitName.length == 0 || splitName.length > 2) {
      return false
    }

    let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(splitName[1])
    if (isUp) {
      idx += 1
      while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
        if (
          allFloorNames.includes(
            splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
          )
        ) {
          return splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
        }
        idx += 1
      }
    } else {
      idx -= 1
      while (idx >= 0) {
        if (
          allFloorNames.includes(
            splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
          )
        ) {
          return splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
        }
        idx -= 1
      }
    }
    return false
  }

  const [canGoUp, setCanGoUp] = useState(false)
  const [canGoDown, setCanGoDown] = useState(false)

  useEffect(() => {
    setCanGoUp(!!getFloorUpOrDown(locationGroup, true))
    setCanGoDown(!!getFloorUpOrDown(locationGroup, false))
  }, [locationGroup])

  const changeFloorUpOrDown = (floor: string, isUp: boolean) => {
    const newFloor = getFloorUpOrDown(floor, isUp)
    if (!newFloor) {
      toast.warn(
        'Cannot change floor - No floor is ' + (isUp ? 'above' : 'below')
      )
      return
    }

    if (allFloorNames.includes(newFloor)) {
      console.log('Setting location to', newFloor)
      changeFloor(newFloor)
    }
  }

  // Add new state for screen size
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)



  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])





  const [referenceNode, setReferenceNode] = useState<{
    id: string
    targetYaw: number
  } | null>(null)

  return (
    <>
      <MobileLayout isMobile={isMobile} currentPoint={currentPoint} setCurrentPoint={setCurrentPoint} allFloorNames={allFloorNames}
      changeFloor={changeFloor} changeFloorUpOrDown={changeFloorUpOrDown} canGoDown={canGoDown} canGoUp={canGoUp} locationGroup={locationGroup} isInstructionsOpen={isInstructionsOpen} setInstructionsOpen={setInstructionsOpen} />

      <DesktopLayout isMobile={isMobile} currentPoint={currentPoint} setCurrentPoint={setCurrentPoint} allFloorNames={allFloorNames}
      changeFloor={changeFloor} changeFloorUpOrDown={changeFloorUpOrDown} canGoDown={canGoDown} canGoUp={canGoUp} locationGroup={locationGroup} isInstructionsOpen={isInstructionsOpen} setInstructionsOpen={setInstructionsOpen} />

      {showMap && (
        <Map
          floorName={locationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPath={highlightedPath}
          isMobile={isMobile}
          closeDrawer={closeDrawer}
          setCloseDrawer={setCloseDrawer}
          cameraRotation={camRotation}
          referenceNode={referenceNode}
        />
      )}

      {allFloorNames.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[999]">
          <SearchBar
            data={allFloorNames}
            highlightCallback={calculateHighlightedPath}
            jumpToCallback={changeFloor}
          />
        </div>
      )}

      <div className="w-screen h-screen overflow-hidden fixed top-0 left-0">
        <ThreeCanvas
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            touchAction: 'none',
          }}
          camera={{ position: [0, 0, 10], fov: isMobile ? 60 : 75 }}
          shadows
        >
          <ambientLight intensity={0.6} />
          <axesHelper />
          <directionalLight castShadow />
          <CameraRotationControls
            initCameraRotation={camRotation}
            setCameraRotation={setCameraRotation}
          />
          <Canvas
            currentId={currentId}
            setCurrentId={setCurrentId}
            currentPoint={currentPoint}
            setCurrentPoint={setCurrentPoint}
            setNeighbours={setFloorWideNeighbours}
            neighbours={floorWideNeighbours}
            isRefined={true}
            highlightedPath={highlightedPath}
            setReferenceNode={setReferenceNode}
          />
        </ThreeCanvas>
      </div>

      {isMobile && showMap && (
        <button
          className="fixed top-4 left-4 z-[1001] bg-white/90 hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center"
          onClick={() => setCloseDrawer(true)}
        >
          <FeatherMap className="w-5 h-5" />
        </button>
      )}

      {showMap && (
        <button
          className={`
            fixed z-[1001] bg-white/90 hover:bg-white rounded-full p-3 shadow-lg 
            flex items-center justify-center transition-all
            ${isMobile ? 'top-4 left-4' : 'top-4 left-4'}
          `}
          onClick={() => setCloseDrawer(!closeDrawer)}
          aria-label={closeDrawer ? 'Close map' : 'Open map'}
        >
          <FeatherMap className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      {showMap && (
        <Map
          floorName={locationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPath={highlightedPath}
          isMobile={isMobile}
          closeDrawer={closeDrawer}
          setCloseDrawer={setCloseDrawer}
          cameraRotation={camRotation}
          referenceNode={referenceNode}
        />
      )}
      
      <ToastContainer
        position={isMobile ? 'bottom-center' : 'top-right'}
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </>
  )
}

export default VirtualTour
