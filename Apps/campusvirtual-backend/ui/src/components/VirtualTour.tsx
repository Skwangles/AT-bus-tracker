import React, { useCallback, useEffect, useRef, useState } from "react";
import { Canvas as ThreeCanvas } from "@react-three/fiber";
import { STARTING_LOCATION_GROUP } from "../consts";
import { API_PREFIX, showMap, PROJECT_NAME } from "../consts";
import axios from "axios";
import CameraRotationControls from "./Camera/RotationController";
import Map from "./Misc/Map";
import SearchBar from "./Search/SearchBar";
import { ToastContainer, Bounce } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import { Map as FeatherMap } from "react-feather";
import Canvas from "./Navigation/Canvas";
import { DesktopLayout } from "./Layouts/DesktopLayout";
import { MobileLayout } from "./Layouts/MobileLayout";
import { buildCalcPath, moveForwardOnPath } from "../utils/pathfinding";
import {
  getChangeFloor,
  getChangeFloorUpOrDown,
  updateMovementAbilities,
} from "../utils/goUporGoDown";
import {
  initFromParams,
  initIdFromParams,
  nullIdValue,
  setOnPopstateEvent,
  updateHistory,
  updateParams,
} from "../utils/updateUrl";
import {
  HotspotObj,
  Label,
  MoveDirectionType,
  NeighbourData,
  PointData,
} from "../types";
import { moveDirection } from "../utils/moveDirection";
import { Camera } from "three";
import Hotspot from "./Navigation/Hotspots";

const VirtualTour: React.FC = () => {
  const [currentId, setCurrentId] = useState<string>(() => initIdFromParams());

  const [currentPoint, setCurrentPoint] = useState<PointData>({
    pose: [],
    ts: "",
    keyframe_id: -1,
    location: "",
    z_trans: 0,
    x_trans: 0,
    y_trans: 0,
  });

  const [hasImage, setHasImage] = useState(false);
  const [locationGroup, setLocationGroup] = useState<string>("");
  const [pathfindMode, setPathfindMode] = useState(false);
  const [highlightedPath, setHighlightedPath] = useState<number[]>([]);
  const [allSearchableLocations, setAllSearchableLocations] = useState<Label[]>(
    []
  );
  const [hotspots, setHotspots] = useState<HotspotObj[]>(() => []);

  const [isLoading, setIsLoading] = useState(true);

  const [isInstructionsOpen, setInstructionsOpen] = useState(false);
  const [closeDrawer, setCloseDrawer] = useState(false);

  const [lastNavigatedToPoint, setLastNavigatedToPoint] = useState<string>("");
  const camRotation = useRef<{
    yaw: number;
    pitch: number;
  }>(initFromParams());

  const changeFloor = getChangeFloor(currentId, setCurrentId);

  // RUN ON FIRST LOAD
  useEffect(() => {
    axios.get<Label[]>(`${API_PREFIX}/api/v1/floors`).then((result) => {
      setAllSearchableLocations(result.data);
    });

    setOnPopstateEvent(setCurrentId, camRotation);

    if (nullIdValue(currentId)) {
      changeFloor(STARTING_LOCATION_GROUP);
    }
  }, []);

  useEffect(() => {
    updateHistory(locationGroup, PROJECT_NAME, currentId);
  }, [
    currentId,
    locationGroup /* DO NOT INCLUDE 'params' otherwise any yaw/pitch change will trigger it */,
  ]);

  const [debounceExpiry, setDebounceExpiry] = useState(Date.now());

  useEffect(() => {
    updateParams(camRotation, setDebounceExpiry, debounceExpiry);
  }, [camRotation.current]);

  useEffect(() => {
    setLocationGroup(currentPoint.location);
  }, [currentPoint]);

  useEffect(() => {
    setPathfindMode(highlightedPath.length > 0);
  }, [highlightedPath]);

  // Pathfinding movement
  const changeFloorUpOrDown = getChangeFloorUpOrDown(
    allSearchableLocations,
    changeFloor
  );
  const calculateHighlightedPath = buildCalcPath(
    currentId,
    setHighlightedPath,
    setLastNavigatedToPoint
  );
  useEffect(() => {
    moveForwardOnPath(
      pathfindMode,
      highlightedPath,
      currentId,
      setHighlightedPath,
      lastNavigatedToPoint,
      calculateHighlightedPath
    );
  }, [currentId]);

  // Update the ability to go up or down with buttons
  const [canGoUp, setCanGoUp] = useState(false);
  const [canGoDown, setCanGoDown] = useState(false);
  useEffect(() => {
    updateMovementAbilities(
      setCanGoUp,
      setCanGoDown,
      allSearchableLocations,
      locationGroup
    );
  }, [locationGroup]);

  // Add new state for screen size
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  console.log("root level hotspots", hotspots);

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

      <MobileLayout
        isMobile={isMobile}
        currentPoint={currentPoint}
        allFloorNames={allSearchableLocations}
        changeFloor={changeFloor}
        changeFloorUpOrDown={changeFloorUpOrDown}
        canGoDown={canGoDown}
        canGoUp={canGoUp}
        locationGroup={locationGroup}
        isLoading={isLoading}
        isInstructionsOpen={isInstructionsOpen}
        setInstructionsOpen={setInstructionsOpen}
      />

      <DesktopLayout
        isMobile={isMobile}
        currentPoint={currentPoint}
        allFloorNames={allSearchableLocations}
        changeFloor={changeFloor}
        changeFloorUpOrDown={changeFloorUpOrDown}
        canGoDown={canGoDown}
        canGoUp={canGoUp}
        isLoading={isLoading}
        locationGroup={locationGroup}
        isInstructionsOpen={isInstructionsOpen}
        setInstructionsOpen={setInstructionsOpen}
      />

      {showMap && (
        <Map
          floorName={locationGroup}
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
          jumpToCallback={changeFloor}
        />
      </div>

      <div className="w-screen h-screen overflow-hidden fixed top-0 left-0">
        <ThreeCanvas
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            touchAction: "none",
          }}
          camera={{ position: [0, 0, 10], fov: isMobile ? 100 : 110 }}
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

      {isMobile && showMap && (
        <button
          className="fixed top-4 left-4 z-[1001] bg-white/90 enabled:hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center disabled:pointer-events-none"
          disabled={!hasImage}
          onClick={() => setCloseDrawer(true)}
        >
          <FeatherMap
            className="w-5 h-5"
            color={hasImage ? "black" : "#A9A9A9"}
          />
        </button>
      )}

      {showMap && (
        <button
          className={`
            fixed z-[1001] bg-white/90 enabled:hover:bg-white rounded-full p-3 shadow-lg 
            flex items-center justify-center enabled:transition-all disabled:pointer-events-none
            ${isMobile ? "top-4 left-4" : "top-4 left-4"}
          `}
          disabled={!hasImage}
          onClick={() => setCloseDrawer(!closeDrawer)}
          aria-label={closeDrawer ? "Close map" : "Open map"}
        >
          <FeatherMap
            className="w-5 h-5"
            aria-hidden="true"
            color={hasImage ? "black" : "#A9A9A9"}
          />
        </button>
      )}

      <ToastContainer
        position={isMobile ? "bottom-center" : "top-right"}
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
  );
};

export default VirtualTour;
