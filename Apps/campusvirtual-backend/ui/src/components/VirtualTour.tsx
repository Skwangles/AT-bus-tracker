import React, { useEffect, useState } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { Label, STARTING_LOCATION_GROUP } from '../consts'
import { API_PREFIX, showMap, PROJECT_NAME } from '../consts'
import axios from 'axios'
import CameraRotationControls from './Camera/RotationController'
import Map from './Misc/Map'
import SearchBar from './Search/SearchBar'
import { toast, ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import { Map as FeatherMap } from 'react-feather'
import Canvas, { NeighbourData } from './Navigation/Canvas'
import { DesktopLayout } from './Layouts/DesktopLayout'
import { MobileLayout } from './Layouts/MobileLayout'
import { getFloorUpOrDown } from '../utils/floorUpOrDownStrategies'
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
  const [hasImage, setHasImage] = useState(false)
  const [locationGroup, setLocationGroup] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allSearchableLocations, setAllSearchableLocations] = useState<Label[]>(
    []
  )

  const [isInstructionsOpen, setInstructionsOpen] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)

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
      .catch((reason) => {
        console.error('Floor could not be found: ' + reason.toString())

        // In the case the 'DEFAULT FLOOR' is not found, we will fetch the first point
        if (Number(currentId) === -1) {
          axios.get<number>(API_PREFIX + '/api/v1/point').then((value) => {
            console.log('Setting ID to ', value.data)
            setCurrentId(value.data.toString())
          })
        }
      })
  }

  // RUN ON FIRST LOAD
  useEffect(() => {
    axios.get<Label[]>(API_PREFIX + '/api/v1/floors').then((result) => {
      console.log('Floors', result.data)
      setAllSearchableLocations(result.data)
    })

    if (
      Number(currentId) === -1 ||
      !params.has('id') ||
      Number(params.get('id')) === -1
    ) {
      changeFloor(STARTING_LOCATION_GROUP)
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

  const [canGoUp, setCanGoUp] = useState(false)
  const [canGoDown, setCanGoDown] = useState(false)

  useEffect(() => {
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
  }, [locationGroup])

  const changeFloorUpOrDown = (floor: string, isUp: boolean) => {
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
      <MobileLayout
        isMobile={isMobile}
        currentPoint={currentPoint}
        setCurrentPoint={setCurrentPoint}
        allFloorNames={allSearchableLocations}
        changeFloor={changeFloor}
        changeFloorUpOrDown={changeFloorUpOrDown}
        canGoDown={canGoDown}
        canGoUp={canGoUp}
        locationGroup={locationGroup}
        isInstructionsOpen={isInstructionsOpen}
        setInstructionsOpen={setInstructionsOpen}
      />

      <DesktopLayout
        isMobile={isMobile}
        currentPoint={currentPoint}
        setCurrentPoint={setCurrentPoint}
        allFloorNames={allSearchableLocations}
        changeFloor={changeFloor}
        changeFloorUpOrDown={changeFloorUpOrDown}
        canGoDown={canGoDown}
        canGoUp={canGoUp}
        locationGroup={locationGroup}
        isInstructionsOpen={isInstructionsOpen}
        setInstructionsOpen={setInstructionsOpen}
      />

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
          hasImage={hasImage}
          setHasImage={setHasImage}
        />
      )}

      <div className="fixed top-0 left-0 right-0 z-[999]">
        <SearchBar
          searchableLabels={allSearchableLocations}
          highlightCallback={calculateHighlightedPath}
          jumpToCallback={changeFloor}
        />
      </div>

      <div className="w-screen h-screen overflow-hidden fixed top-0 left-0">
        <ThreeCanvas
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            touchAction: 'none',
          }}
          camera={{ position: [0, 0, 10], fov: isMobile ? 100 : 110 }}
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
          className="fixed top-4 left-4 z-[1001] bg-white/90 enabled:hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center disabled:pointer-events-none"
          disabled={!hasImage}
          onClick={() => setCloseDrawer(true)}
        >
          <FeatherMap
            className="w-5 h-5"
            color={hasImage ? 'black' : '#A9A9A9'}
          />
        </button>
      )}

      {showMap && (
        <button
          className={`
            fixed z-[1001] bg-white/90 enabled:hover:bg-white rounded-full p-3 shadow-lg 
            flex items-center justify-center enabled:transition-all disabled:pointer-events-none
            ${isMobile ? 'top-4 left-4' : 'top-4 left-4'}
          `}
          disabled={!hasImage}
          onClick={() => setCloseDrawer(!closeDrawer)}
          aria-label={closeDrawer ? 'Close map' : 'Open map'}
        >
          <FeatherMap
            className="w-5 h-5"
            aria-hidden="true"
            color={hasImage ? 'black' : '#A9A9A9'}
          />
        </button>
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
