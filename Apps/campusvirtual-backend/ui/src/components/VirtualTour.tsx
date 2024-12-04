import React, { useEffect, useState, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
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
import VirtualTourContent from './VirtualTourContent'
import LocationChangeControls from './LocationChangeControls'
import { NeighbourData } from './VirtualTourContent'
import { AxesHelper, Camera, Vector3 } from 'three'

export interface PointData {
  pose: number[]
  ts: string
  keyframe_id: number
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
  })

  const [floorWideNeighbours, setFloorWideNeighbours] = useState<
    NeighbourData[]
  >([])
  const [locationGroup, setLocationGroup] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allFloorNames, setAllFloorNames] = useState<string[]>([])
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isInstructionsOpen, setInstructionsOpen] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)

  const [calcAngleOfPointFunc, setCalcAngleOfPointFunc] =
    useState<(target: number) => number>()
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
      changeFloor('FG.G')
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

  useEffect(() => {
    if (isMobile && !showMobileMenu) {
      console.log('Closing instructions')
      setInstructionsOpen(false)
    }
  }, [isMobile, showMobileMenu])
  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const drawerRef = useRef<HTMLDivElement>(null)

  const [drawerHeight, setDrawerHeight] = useState(0)

  useEffect(() => {
    if (drawerRef.current) {
      setDrawerHeight(drawerRef.current.scrollHeight)
    }
  }, [showMobileMenu])

  const [referenceNode, setReferenceNode] = useState<{
    id: string
    targetYaw: number
  } | null>(null)

  return (
    <>
      {/* Location indicator - make text smaller on mobile */}
      {/* Mobile menu button */}
      {isMobile && (
        <>
          {/* Location indicator with chevron */}
          <div
            className={`fixed left-1/2 -translate-x-1/2 z-[999] bg-[#101010F0] text-white px-4 py-2 shadow-lg flex items-center gap-2 cursor-pointer ${
              showMobileMenu ? 'rounded-t-xl' : 'rounded-xl'
            }`}
            style={{
              bottom: showMobileMenu ? `${drawerHeight}px` : '1rem', // Adjust to align with drawer
              transition: 'all 0.3s ease-in-out',
            }}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <MapPin className="w-5 h-5" />
            <span>You are in: {currentPoint.location}</span>
            <ChevronUp
              className={`w-5 h-5 transition-transform duration-300 ${
                showMobileMenu ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Slide-up drawer */}
          <div
            ref={drawerRef}
            className={`fixed left-1/2 -translate-x-1/2 bg-[#101010F0] text-white shadow-lg transition-all duration-300 ease-in-out ${
              showMobileMenu ? 'rounded-b-xl' : 'rounded-xl'
            }`}
            style={{
              bottom: showMobileMenu ? '0' : `-${drawerHeight}px`, // Use negative height to hide the drawer completely
              width: '90%', // Match the width of the location indicator
              maxHeight: '70vh', // Set a max height to prevent overflow
              overflowY: 'auto', // Allow scrolling if content exceeds max height
              transition: 'all 0.3s ease-in-out',
              zIndex: 998,
            }}
          >
            <div className="p-4 space-y-4">
              {/* Floor controls */}
              <div className="border-t border-gray-700 pt-4">
                <LocationChangeControls
                  canGoUp={canGoUp}
                  canGoDown={canGoDown}
                  changeFloorUpOrDown={changeFloorUpOrDown}
                  locationGroup={locationGroup}
                  allFloorNames={allFloorNames}
                  changeFloor={changeFloor}
                />
              </div>

              {/* Instructions */}
              {isInstructionsOpen && (
                <Instructions
                  point={currentPoint}
                  isOpen={isInstructionsOpen}
                  setIsOpen={setInstructionsOpen}
                  className="mobile-instructions"
                  showToggle={false}
                />
              )}
            </div>
          </div>

          {/* Instructions button */}
          <button
            className="fixed bottom-4 right-4 z-[1001] bg-white/90 hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center"
            onClick={() => setInstructionsOpen(!isInstructionsOpen)}
          >
            <Info className="w-5 h-5 text-black" />
          </button>
        </>
      )}

      {/* Desktop layout */}
      {!isMobile && (
        <>
          <div className="fixed left-0 bottom-0 z-[999] m-4">
            <div className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-black/90 text-white backdrop-blur-sm shadow-lg transition-all">
              <MapPin className="w-6 h-6 text-blue-400" aria-hidden="true" />
              <span className="truncate">
                You are in:{' '}
                <span className="text-blue-400">{currentPoint.location}</span>
              </span>
            </div>
          </div>

          {/* Position LocationChangeControls in the bottom right */}
          <div className="fixed right-0 bottom-0 z-50 m-4">
            <LocationChangeControls
              canGoUp={canGoUp}
              canGoDown={canGoDown}
              changeFloorUpOrDown={changeFloorUpOrDown}
              locationGroup={locationGroup}
              allFloorNames={allFloorNames}
              changeFloor={changeFloor}
            />
          </div>

          <Instructions
            point={currentPoint}
            isOpen={isInstructionsOpen}
            setIsOpen={setInstructionsOpen}
            className="desktop-instructions"
            showToggle={true}
          />
        </>
      )}

      {/* Adjust Map size and position for mobile */}
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

      {/* Move SearchBar to top */}
      {SHOW_NAV_SEARCH && allFloorNames.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[999]">
          <SearchBar
            data={allFloorNames}
            highlightCallback={calculateHighlightedPath}
            jumpToCallback={changeFloor}
          />
        </div>
      )}

      {/* Adjust Canvas for mobile */}
      <div className="w-screen h-screen overflow-hidden fixed top-0 left-0">
        <Canvas
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
          <VirtualTourContent
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
        </Canvas>
      </div>

      {/* Adjust toast position for mobile */}
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

      {/* Add mobile map toggle button */}
      {isMobile && showMap && (
        <button
          className="fixed top-4 left-4 z-[1001] bg-white/90 hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center"
          onClick={() => setCloseDrawer(true)}
        >
          <FeatherMap className="w-5 h-5" />
        </button>
      )}

      {/* Map toggle button - for both mobile and desktop */}
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

      {/* Map component */}
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
    </>
  )
}

export default VirtualTour
