import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { API_PREFIX, showMap, PROJECT_NAME } from '../consts'
import axios from 'axios'
import CameraRotationControls from './Camera/RotationController'
import Map from './Misc/Map'
import SearchBar from './Search/SearchBar'
import { ToastContainer, Bounce, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import { Map as FeatherMap, Info, X } from 'react-feather'
import Canvas from './Navigation/Canvas'
import { buildCalcPath, moveForwardOnPath } from '../utils/pathfinding'
import {
  initFromParams,
  initIdFromParams,
  nullIdValue,
  setOnPopstateEvent,
  updateHistory,
  updateParams,
} from '../utils/updateUrl'
import { HotspotObj, Label, PointData } from '../types'
import Instructions from './Misc/Instructions'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

// Helper component to get camera reference
interface CameraPositionGetterProps {
  setCameraRef: (camera: THREE.Camera) => void
}

const CameraPositionGetter: React.FC<CameraPositionGetterProps> = ({ setCameraRef }) => {
  const { camera } = useThree()

  useEffect(() => {
    setCameraRef(camera)
  }, [camera, setCameraRef])

  return null
}

const VirtualTourContent: React.FC = () => {
  // State declarations
  const [currentId, setCurrentId] = useState<string>(initIdFromParams())
  const [currentPoint, setCurrentPoint] = useState<PointData>(() => ({
    pose: Array(16).fill(0),
    ts: Date.now().toString(),
    keyframe_id: 0,
    x_trans: 0,
    y_trans: 0,
    z_trans: 0,
    location: ''
  }))
  const [currentLocationGroup, setCurrentLocationGroup] = useState<string>('')
  const [hasImage, setHasImage] = useState(false)
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allSearchableLocations, setAllSearchableLocations] = useState<Label[]>([])
  const [hotspots, setHotspots] = useState<HotspotObj[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)
  const [lastNavigatedToPoint, setLastNavigatedToPoint] = useState<string>("")
  const [debounceExpiry, setDebounceExpiry] = useState(Date.now())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const camRotation = useRef(initFromParams())

  // Effects
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Callbacks
  const changeLocation = useCallback((location: string) => {
    setIsLoading(true);
    axios
      .get<{ keyframe_id: number }>(
        `${API_PREFIX}/api/v1/locationgroup/${location}/point`
      )
      .then((value) => {
        const result = value.data.keyframe_id;
        if (isNaN(Number(result))) {
          setIsLoading(false);
          return;
        }
        setCurrentId(Number(result).toString());
        setIsLoading(false);
      })
      .catch((reason) => {
        toast.warn(location + ' is not a reachable location.');
        setIsLoading(false);
        // In the case the 'DEFAULT LOCATION' is not found, we will fetch the first point
        if (Number(currentId) === -1) {
          axios.get<number>(`${API_PREFIX}/api/v1/point`).then((value) => {
            setCurrentId(value.data.toString());
          });
        }
      });
  }, [currentId]);

  const calculateHighlightedPath = useCallback(
    buildCalcPath(currentId, setHighlightedPath, setLastNavigatedToPoint, cameraRef.current, hotspots),
    [currentId, hotspots]
  )

  // Effects
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch labels
        const labelsResult = await axios.get<Label[]>(`${API_PREFIX}/api/v1/locationgroup/labels`)
        setAllSearchableLocations(labelsResult.data)

        // If ID is -1, fetch first point ID from backend
        if (nullIdValue(currentId)) {
          const defaultIdResult = await axios.get(`${API_PREFIX}/api/v1/point/first`)
          const defaultId = defaultIdResult.data
          setCurrentId(defaultId)
          updateHistory(currentLocationGroup, PROJECT_NAME, defaultId)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
    setOnPopstateEvent(setCurrentId, camRotation)
  }, [])

  useEffect(() => {
    updateHistory(currentLocationGroup, PROJECT_NAME, currentId)
  }, [currentId, currentLocationGroup])

  useEffect(() => {
    updateParams(camRotation, setDebounceExpiry, debounceExpiry)
  }, [camRotation.current, debounceExpiry])

  useEffect(() => {
    setCurrentLocationGroup(currentPoint?.location || '')
  }, [currentPoint])

  useEffect(() => {
    moveForwardOnPath(
      highlightedPath.length > 0,
      highlightedPath,
      currentId,
      setHighlightedPath,
      lastNavigatedToPoint,
      calculateHighlightedPath
    )
  }, [currentId, highlightedPath, lastNavigatedToPoint, calculateHighlightedPath])

  return (
    <>
      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-spinner">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
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
          camera={{ position: [0, 0, 10], fov: isMobile ? 100 : 110 }}
          shadows
        >
          <ambientLight intensity={0.6} />
          <directionalLight castShadow />
          <CameraPositionGetter setCameraRef={(camera) => { cameraRef.current = camera }} />
          <CameraRotationControls
            setCurrentId={setCurrentId}
            hotspots={hotspots}
            camRotation={camRotation}
          />
          <Canvas
            currentId={currentId}
            setCurrentId={setCurrentId}
            setHotspots={setHotspots}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
            hotspots={hotspots}
            setCurrentPoint={setCurrentPoint}
            isPathfindingMode={highlightedPath.length > 0}
            highlightedPath={highlightedPath}
          />
        </ThreeCanvas>
      </div>

      {showMap && (
        <Map
          floorName={currentLocationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPoints={highlightedPath}
          isMobile={isMobile}
          closeDrawer={closeDrawer}
          setCloseDrawer={setCloseDrawer}
          hasImage={hasImage}
          setHasImage={setHasImage}
          isPathfindingMode={highlightedPath.length > 0}
        />
      )}

      <div className="fixed top-0 left-0 right-0 z-[999]">
        <SearchBar
          currentPoint={currentPoint}
          isPathfindingMode={highlightedPath.length > 0}
          searchableLabels={allSearchableLocations}
          highlightCallback={calculateHighlightedPath}
          jumpToCallback={changeLocation}
        />
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

      {/* Instructions Floating Button */}
      <button
        className="fixed bottom-6 right-6 z-[1001] bg-white/90 enabled:hover:bg-white rounded-full px-6 py-3 shadow-lg flex items-center justify-center gap-2 enabled:transition-all disabled:pointer-events-none border border-gray-300"
        onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
        aria-label={isInstructionsOpen ? "Close instructions" : "Show instructions"}
      >
        {isInstructionsOpen ? (
          <>
            <X size={20} />
            <span>Close</span>
          </>
        ) : (
          <>
            <Info size={20} />
            <span>Instructions</span>
          </>
        )}
      </button>

      {/* Instructions Component */}
      <Instructions
        point={currentPoint}
        isOpen={isInstructionsOpen}
        setIsOpen={setIsInstructionsOpen}
        className={isMobile ? "mobile-instructions" : "desktop-instructions"}
      />

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

export default VirtualTourContent;
