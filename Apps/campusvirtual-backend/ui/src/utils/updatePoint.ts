import axios from "axios";
import { API_PREFIX } from "../consts";
import { PointData, NeighbourData } from "../types";
import { toast } from "react-toastify";
import { getPositionOfNode, getYRotation } from "./utils";
import { checkPoint } from "./validators/pointValidator";
import * as THREE from "three";
import { useCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

export async function getPointAndNeighbours(pointId: string) {
  const pointResponse = await axios.get<PointData>(
    `${API_PREFIX}/api/v1/point/${pointId}`
  );

  const neighboursResponse = await axios.get<NeighbourData[]>(
    `${API_PREFIX}/api/v1/point/${pointId}/neighbours/8/2`
  );

  return { point: pointResponse.data, neighbours: neighboursResponse.data };
}

const { camera } = useThree();

export const fetchPointData = async (
  pointId: string,
  setCurrentPoint,
  setCurrentImage,
  setHotspots,
  setCurrentPosition,
  setRotation
) => {
  try {
    const { point, neighbours } = await getPointAndNeighbours(pointId);

    if (!checkPoint(point)) {
      console.error("Invalid point fetched:" + JSON.stringify(point));
      return;
    }

    updatePoint(point, setCurrentPoint, setCurrentImage);
    updateHotSpots(neighbours, setHotspots);
    updatePosition(point, camera, setCurrentPosition);
    updateRotation(point, setRotation);
  } catch (error) {
    toast.error("Could not find point");
  }
};

export function updatePoint(point, setCurrentPoint, setCurrentImage) {
  if (!checkPoint(point)) {
    console.error("Invalid point:" + JSON.stringify(point));
    return;
  }

  setCurrentPoint(point);
  setCurrentImage(Number(point.ts).toFixed(5));
}

export function updateHotSpots(neighbours, setHotspots) {
  const newHotspots = neighbours.map((neighbour) => {
    if (!checkPoint(neighbour)) {
      console.warn("Invalid hotspot:" + JSON.stringify(neighbour));
      return;
    }

    const pos = getPositionOfNode(neighbour);
    const m = new THREE.Matrix4();

    //@ts-expect-error - neighbour.pose is in the right format
    m.set(...neighbour.pose);

    return {
      position: [pos[0], pos[1], pos[2]],
      rotation: [0, getYRotation(neighbour.pose), 0],
      pose: m,
      id: neighbour.keyframe_id,
      ts: neighbour.ts,
    };
  });

  setHotspots(newHotspots);
}

export function updateRotation(point: PointData, setRotation) {
  if (!checkPoint(point)) {
    console.warn("Invalid hotspot:" + JSON.stringify(point));
    return;
  }

  const newRotation = getYRotation(point.pose);
  setRotation([0, newRotation, 0]);
}

export function updatePosition(
  point: PointData,
  camera: THREE.Camera,
  setCurrentPosition
) {
  if (!checkPoint(point)) {
    console.warn("Invalid hotspot:" + JSON.stringify(point));
    return;
  }

  const newPosition = getPositionOfNode(point);
  setCurrentPosition(new THREE.Vector3(...newPosition));
  camera.position.set(newPosition[0], newPosition[1], newPosition[2]);
}
