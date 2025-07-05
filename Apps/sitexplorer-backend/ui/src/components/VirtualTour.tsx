import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { showMap } from '../consts'
import CameraRotationControls from './Camera/RotationController'
import Map from './Misc/Map'
import { ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import Canvas from './Navigation/Canvas'
import { createNewPath, updatePath } from '../utils/pathfinding'
import {
  initFromParams,
  initIdFromParams,
  refetchParams,
  setOnPopstateEvent,
  updateHistory,
} from '../utils/updateUrl'
import { HotspotObj, Label, PointData, MoveDirectionType } from '../types'
import { fetchLabelsData } from '../utils/labelUtils'
import Instructions from './Misc/Instructions'
import { useTranslation } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../theme'
import SideDrawer from './SideDrawer'
import MovementControls from './MovementControls'
import FloatingActionButtons from './Misc/FloatingActionButtons'
import ArrivalAnimation from './Misc/ArrivalAnimation'
import LoadingIndicator from './Misc/LoadingIndicator'
import TopPanel from './Search/TopPanel'

const VirtualTourContent: React.FC = () => {
  refetchParams();
  const { t } = useTranslation('common');

  // Main info states
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

  // Pathfinding mode states
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [pathIndex, setPathIndex] = useState(-1) // -1 means no path, 0 means at start of path, 1 means at second point, etc.
  const [restrictToPath, setRestrictToPath] = useState(false)

  // Hotspot states
  const [allSearchableLocations, setAllSearchableLocations] = useState<Label[]>([])
  const [hotspots, setHotspots] = useState<HotspotObj[]>([])

  // Camera 
  const camRotation = useRef(initFromParams())
  const cameraControlsRef = useRef<{ handleMove: (direction: MoveDirectionType) => void; handleRotate: (direction: 'left' | 'right') => void; stopRotate: () => void; } | null>(null);

  // Components
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLDivElement>(null);
  const isClearingPathRef = useRef(false);

  // Arrival animation state
  const [showArrivalAnimation, setShowArrivalAnimation] = useState(false);
  const [destinationName, setDestinationName] = useState('');

  // Effects
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearchOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node) &&
        searchToggleRef.current &&
        !searchToggleRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mouseup', handleClickOutside as any);
    return () => document.removeEventListener('mouseup', handleClickOutside as any);
  }, [isSearchOpen]);

  // Callbacks
  const handleSuggestionClick = useCallback((suggestion: Label, hide: boolean = false) => {
    setCurrentId(suggestion.pointId.toString());

    if (hide) {
      setIsSearchOpen(false);
    }
  }, [t]);

  const handleClearPath = useCallback(() => {
    isClearingPathRef.current = true;
    setHighlightedPath([]);
    setPathIndex(-1);
    setDestinationName('');
    setTimeout(() => {
      isClearingPathRef.current = false;
    }, 100);
  }, []);

  const handleArrival = useCallback((destination: string) => {
    console.log("handleArrival", destination)

    setDestinationName(destination);
    setShowArrivalAnimation(true);
    // Clear pathfinding mode when arriving at destination
    setHighlightedPath([]);
    setPathIndex(-1);
  }, []);

  const handleArrivalAnimationComplete = useCallback(() => {
    setShowArrivalAnimation(false);
    setDestinationName('');
  }, []);

  const calculateHighlightedPath = async (selectedLocation: string, displayLabel?: string) => {
    await createNewPath(Number(currentId), selectedLocation, setHighlightedPath, setPathIndex, setDestinationName, displayLabel)
  }

  // Effects
  useEffect(() => {
    console.log("Fetching label data and registering popstate event")
    fetchLabelsData(setAllSearchableLocations, currentId, setCurrentId, updateHistory, currentLocationGroup)
    setOnPopstateEvent(setCurrentId, camRotation)
  }, [])

  useEffect(() => {
    const newLocationGroup = currentPoint?.location || ''
    console.log("Updating history - currentId: ", currentId, " currentLocationGroup: ", newLocationGroup)
    updateHistory(newLocationGroup, 'SiteXplore', currentId)
    setCurrentLocationGroup(newLocationGroup)
  }, [currentId, currentPoint])

  useEffect(() => {
    if (isClearingPathRef.current) return;

    updatePath(
      pathIndex >= 0,
      currentId,
      highlightedPath,
      setHighlightedPath,
      setPathIndex,
      destinationName,
      handleArrival
    )
  }, [currentId, highlightedPath, destinationName, handleArrival, restrictToPath])

  return (
    <ThemeProvider theme={theme}>
      <div style={{ background: '#D0EFEF', minHeight: '100vh' }}>
        <TopPanel
          currentPoint={currentPoint}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          setDrawerOpen={setDrawerOpen}
          searchToggleRef={searchToggleRef}
          searchContainerRef={searchContainerRef}
          allSearchableLocations={allSearchableLocations}
          highlightedPath={highlightedPath}
          handleClearPath={handleClearPath}
          isMobile={isMobile}
          calculateHighlightedPath={calculateHighlightedPath}
          handleSuggestionClick={handleSuggestionClick}
        />
        <SideDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onInfoClick={() => setIsInstructionsOpen(true)}
          restrictToPath={restrictToPath}
          onRestrictToPathChange={setRestrictToPath}
        />

        <LoadingIndicator isLoading={isLoading} />

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
            <CameraRotationControls
              ref={cameraControlsRef}
              setCurrentId={setCurrentId}
              hotspots={hotspots}
              camRotation={camRotation}
              isPathfindingMode={pathIndex >= 0}
              highlightedPath={highlightedPath}
            />
            <Canvas
              currentId={currentId}
              setCurrentId={setCurrentId}
              setHotspots={setHotspots}
              setIsLoading={setIsLoading}
              isLoading={isLoading}
              hotspots={hotspots}
              setCurrentPoint={setCurrentPoint}
              isPathfindingMode={pathIndex >= 0}
              highlightedPath={highlightedPath}
            />
          </ThreeCanvas>
        </div>

        <Map
          floorName={currentLocationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPoints={highlightedPath}
          isMobile={isMobile}
          closeDrawer={isMapOpen}
          setCloseDrawer={setIsMapOpen}
          hasImage={hasImage}
          setHasImage={setHasImage}
          isPathfindingMode={pathIndex >= 0}
        />


        {/* Floating Action Buttons */}
        <FloatingActionButtons
          showMap={showMap}
          hasImage={hasImage}
          isMapOpen={isMapOpen}
          isMobile={isMobile}
          onMapClick={() => {
            if (!hasImage) return;
            if (isMobile) {
              setIsMapOpen(true);
            } else {
              setIsMapOpen(!isMapOpen);
            }
          }}
          onSearchClick={() => setIsSearchOpen(!isSearchOpen)}
        />

        {/* Instructions Component */}
        <Instructions
          isOpen={isInstructionsOpen}
          onClose={() => setIsInstructionsOpen(false)}
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

        {/* Look and move controls */}
        <MovementControls
          onMove={(direction) => cameraControlsRef.current?.handleMove(direction)}
          onRotate={(direction) => cameraControlsRef.current?.handleRotate(direction)}
          onStopRotate={() => cameraControlsRef.current?.stopRotate()}
        />

        {/* Arrival Animation */}
        <ArrivalAnimation
          isVisible={showArrivalAnimation}
          destinationName={destinationName}
          onAnimationComplete={handleArrivalAnimationComplete}
        />
      </div>
    </ThemeProvider>
  )
}

const VirtualTour: React.FC = () => (
  <ThemeProvider theme={theme}>
    <VirtualTourContent />
  </ThemeProvider>
);

export default VirtualTour
