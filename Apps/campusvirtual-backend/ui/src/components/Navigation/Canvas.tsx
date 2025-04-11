import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import axios from "axios";
import { API_PREFIX } from "../../consts";
import { getPositionOfNode, getYRotation } from "../../utils/utils";
import SphereWithHotspots from "./SphereWithHotspots";
import { NeighbourData, type HotspotObj, type PointData } from "../../types";
import { toast } from "react-toastify";
import { fetchPointData, getPointAndNeighbours } from "../../utils/updatePoint";
import { checkPoint } from "../../utils/validators/pointValidator";

interface CanvasProps {
  hotspots: HotspotObj[];
  setHotspots: (hotspots: HotspotObj[]) => void;
  currentId: string;
  setCurrentId: (id: string) => void;
  setCurrentPoint: (point: PointData) => void;
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
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>(
    new THREE.Vector3()
  );
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);

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
