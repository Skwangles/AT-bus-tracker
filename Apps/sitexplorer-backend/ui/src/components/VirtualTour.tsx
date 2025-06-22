import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as ThreeCanvas } from '@react-three/fiber'
import { API_PREFIX, showMap } from '../consts'
import axios from 'axios'
import CameraRotationControls from './Camera/RotationController'
import Map from './Misc/Map'
import SearchBar from './Search/SearchBar'
import { ToastContainer, Bounce, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'
import Canvas from './Navigation/Canvas'
import { buildCalcPath, moveForwardOnPath } from '../utils/pathfinding'
import {
  initFromParams,
  initIdFromParams,
  nullIdValue,
  refetchParams,
  setOnPopstateEvent,
  updateHistory,
  updateParams,
} from '../utils/updateUrl'
import { HotspotObj, Label, PointData, MoveDirectionType } from '../types'
import { getLabelLongName } from '../utils/labelUtils'
import Instructions from './Misc/Instructions'
import * as THREE from 'three'
import { useTranslation } from 'react-i18next'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../theme'
import MenuIcon from '@mui/icons-material/Menu'
import MobileDrawer from './SideDrawer'
import CurrentLocation from './Search/CurrentLocation'
import MovementControls from './MovementControls'
import FloatingActionButtons from './Misc/FloatingActionButtons'
import { Clear as ClearIcon } from '@mui/icons-material'
import ArrivalAnimation from './Misc/ArrivalAnimation'

const VirtualTourContent: React.FC = () => {
  refetchParams();
  const { t } = useTranslation('common');
  
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
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [debounceExpiry, setDebounceExpiry] = useState(Date.now())
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const camRotation = useRef(initFromParams())
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const cameraControlsRef = useRef<{ handleMove: (direction: MoveDirectionType) => void; handleRotate: (direction: 'left' | 'right') => void; stopRotate: () => void; } | null>(null);
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
    setDestinationName('');
    setTimeout(() => {
      isClearingPathRef.current = false;
    }, 100);
  }, []);

  const handleArrival = useCallback((destination: string) => {
    setDestinationName(destination);
    setShowArrivalAnimation(true);
  }, []);

  const handleArrivalAnimationComplete = useCallback(() => {
    setShowArrivalAnimation(false);
    setDestinationName('');
  }, []);

  const calculateHighlightedPath = useCallback(
    buildCalcPath(currentId, setHighlightedPath, cameraRef.current, hotspots, setDestinationName),
    [currentId]
  )

  // Effects
  useEffect(() => {
    console.log("Initialising Virtual Tour")
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
          updateHistory(currentLocationGroup, 'Sitexplorer', defaultId)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    fetchData()
    setOnPopstateEvent(setCurrentId, camRotation)
  }, [])

  useEffect(() => {
    console.log("Updating history - currentId: ", currentId, " currentLocationGroup: ", currentLocationGroup)
    updateHistory(currentLocationGroup, 'Sitexplorer', currentId)
  }, [currentId, currentLocationGroup])

  useEffect(() => { // TODO: This is never called
    console.log("Setting cam rotation to:", camRotation.current)
    updateParams(camRotation, setDebounceExpiry, debounceExpiry)
  }, [camRotation.current, debounceExpiry])

  useEffect(() => {
    console.log("Setting current location group to:", currentPoint?.location)
    setCurrentLocationGroup(currentPoint?.location || '')
  }, [currentPoint])

  useEffect(() => {
    if (isClearingPathRef.current) return;
    
    moveForwardOnPath(
      highlightedPath.length > 0,
      highlightedPath,
      currentId,
      setHighlightedPath,
      calculateHighlightedPath,
      destinationName,
      handleArrival
    )
  }, [currentId, highlightedPath, destinationName, handleArrival])

  return (
    <ThemeProvider theme={theme}>
      <div style={{ background: '#D0EFEF', minHeight: '100vh' }}>
        {/* Mobile Drawer */}
        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onInfoClick={() => setIsInstructionsOpen(true)}
        />
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
            <CameraRotationControls
              ref={cameraControlsRef}
              setCurrentId={setCurrentId}
              hotspots={hotspots}
              camRotation={camRotation}
              isPathfindingMode={highlightedPath.length > 0}
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
              isPathfindingMode={highlightedPath.length > 0}
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
            isPathfindingMode={highlightedPath.length > 0}
          />

        <div className="fixed top-0 left-0 right-0 z-[999] p-4 flex items-center justify-between">
          {/* Spacer to balance the menu button on the right */}
          <div style={{ width: '48px' }} />

          {/* Centered Container for Location and Search */}
          <div ref={searchToggleRef}>
            <CurrentLocation
              location={currentPoint.location}
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              isOpen={isSearchOpen}
            />
          </div>

          {/* Menu Button (Hamburger) */}
          <button
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{ background: '#E5F3F3', color: '#1B1B1E', border: 'none', width: '48px', height: '48px' }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon style={{ fontSize: 32 }} />
          </button>
        </div>

        {/* Clear Pathfinding Button */}
        {highlightedPath.length > 0 && (
          <div 
            className="fixed z-[997] flex justify-center"
            style={{
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '10px',
            }}
          >
            <button
              className="px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-200 hover:shadow-xl flex items-center gap-2"
              style={{ 
                background: '#F87171',
                color: 'white', 
                border: 'none',
                backdropFilter: 'blur(10px)',
              }}
              onClick={handleClearPath}
              aria-label="Clear pathfinding"
            >
              <ClearIcon sx={{ fontSize: 20 }} />
              {t('pathfinding.clear', 'Clear Path')}
            </button>
          </div>
        )}

        {isSearchOpen && (
          <div 
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[998] w-full max-w-md px-4" 
            ref={searchContainerRef}
            style={{
              top: isMobile ? '80px' : 'calc(2rem + 24px)',
              left: isMobile ? '50%' : '50%',
              transform: isMobile ? 'translateX(-50%)' : 'translateX(-50%)',
            }}
          >
            <SearchBar
              currentPoint={currentPoint}
              searchableLabels={allSearchableLocations}
              jumpToCallback={(selected) => {
                const label = allSearchableLocations.find(l => l.query === selected || getLabelLongName(l) === selected);
                if (label) {
                  handleSuggestionClick(label, true)
                } else {
                  console.error("Could not find label for query:", selected);
                  toast.error(t('location.navigate.error', 'Could not navigate to location.'));
                }
              }}
              highlightCallback={calculateHighlightedPath}
              onClose={() => setIsSearchOpen(false)}
            />
          </div>
        )}

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
