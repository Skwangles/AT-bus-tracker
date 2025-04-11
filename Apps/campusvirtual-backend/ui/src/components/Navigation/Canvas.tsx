import { useEffect, useState } from "react";
import * as THREE from "three";
import SphereWithHotspots from "./SphereWithHotspots";
import {
  ThreeNumbersArray,
  type HotspotObj,
  type PointData,
} from "../../types";
import { fetchPointData } from "../../utils/updatePoint";

interface CanvasProps {
  hotspots: HotspotObj[];
  setHotspots: React.Dispatch<React.SetStateAction<HotspotObj[]>>;
  currentId: string;
  setCurrentId: React.Dispatch<React.SetStateAction<string>>;
  setCurrentPoint: React.Dispatch<React.SetStateAction<PointData>>;
  isPathfindingMode: boolean;
  highlightedPath: number[];
}

const Canvas: React.FC<CanvasProps> = ({
  hotspots,
  setHotspots,
  currentId,
  setCurrentId,
  setCurrentPoint,
  isPathfindingMode,
  highlightedPath,
}) => {
  const [currentImage, setCurrentImage] = useState<string>("");
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(
    new THREE.Vector3()
  );
  const [rotation, setRotation] = useState<ThreeNumbersArray>([0, 0, 0]);

  useEffect(() => {
    fetchPointData(
      currentId,
      setCurrentPoint,
      setCurrentImage,
      setHotspots,
      setCurrentPosition,
      setRotation
    );
  }, [currentId, isPathfindingMode]); // pathfinding mode deletes non-path points, so need to refetch

  const handleHotspotClick = (hotspot: HotspotObj) => {
    setCurrentId(hotspot.id);
  };

  return currentImage ? (
    <SphereWithHotspots
      position={currentPosition}
      textureUrl={currentImage}
      hotspots={hotspots}
      onHotspotClick={handleHotspotClick}
      rotation={rotation}
      isPathfindingMode={isPathfindingMode}
      highlightedOrbs={highlightedPath}
    />
  ) : (
    <></>
  );
};

export default Canvas;
