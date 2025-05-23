import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { API_PREFIX, showMap, PROJECT_NAME } from '../consts'
import axios from 'axios'
import CameraRotationControls from './Camera/RotationController'
import Map from './Misc/Map'
import SearchBar from './Search/SearchBar'
import { ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import { Map as FeatherMap } from 'react-feather'
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

const VirtualTourContent: React.FC = () => {
  // State declarations
  const [currentId, setCurrentId] = useState<string>(() => initIdFromParams())
  const [currentPoint, setCurrentPoint] = useState<PointData>({
    pose: [],
    ts: '',
    keyframe_id: -1,
    location: '',
    z_trans: 0,
    x_trans: 0,
    y_trans: 0,
  })
  const [currentLocationGroup, setCurrentLocationGroup] = useState<string>('')
  const [allLocationNames, setAllLocationNames] = useState<string[]>([])
  const [hasImage, setHasImage] = useState(false)
  const [pathfindMode, setPathfindMode] = useState(false)
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allSearchableLocations, setAllSearchableLocations] = useState<Label[]>([])
  const [hotspots, setHotspots] = useState<HotspotObj[]>(() => [])
  const [isLoading, setIsLoading] = useState(true)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [closeDrawer, setCloseDrawer] = useState(false)
  const [lastNavigatedToPoint, setLastNavigatedToPoint] = useState<string>('')
  const [debounceExpiry, setDebounceExpiry] = useState(Date.now())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  // Refs
  const camRotation = useRef<{
    yaw: number
    pitch: number
  }>(initFromParams())

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
    setIsLoading(true)
    // ... existing location change logic ...
  }, [])

  const calculateHighlightedPath = useCallback(
    buildCalcPath(currentId, setHighlightedPath, setLastNavigatedToPoint),
    [currentId]
  )

  // Effects
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch labels
        const labelsResult = await axios.get<Label[]>(`${API_PREFIX}/api/v1/locationgroup/labels`)
        setAllSearchableLocations(labelsResult.data)
        setAllLocationNames(labelsResult.data.map(v => v.query))

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
    setPathfindMode(highlightedPath.length > 0)
  }, [highlightedPath])

  useEffect(() => {
    moveForwardOnPath(
      pathfindMode,
      highlightedPath,
      currentId,
      setHighlightedPath,
      lastNavigatedToPoint,
      calculateHighlightedPath
    )
  }, [currentId, pathfindMode, highlightedPath, lastNavigatedToPoint, calculateHighlightedPath])

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
          camera={{ position: [0, 0, 10], fov: isMobile ? 90 : 90 }}
          shadows
        >
          <ambientLight intensity={0.6} />
          <directionalLight castShadow />
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
            isPathfindingMode={pathfindMode}
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
          isPathfindingMode={pathfindMode}
        />
      )}

      <div className="fixed top-0 left-0 right-0 z-[999]">
        <SearchBar
          currentPoint={currentPoint}
          isPathfindingMode={pathfindMode}
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
        className="fixed bottom-6 right-6 z-[1001] bg-white/90 enabled:hover:bg-white rounded-full px-6 py-3 shadow-lg flex items-center justify-center enabled:transition-all disabled:pointer-events-none border border-gray-300"
        onClick={() => setIsInstructionsOpen(true)}
        aria-label="Show instructions"
      >
        Instructions
      </button>

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
