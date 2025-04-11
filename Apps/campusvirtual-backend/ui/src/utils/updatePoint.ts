import axios from "axios";
import { API_PREFIX } from "../consts";
import {
  PointData,
  NeighbourData,
  HotspotObj,
  ThreeNumbersArray,
} from "../types";
import { toast } from "react-toastify";
import {
  getPointAsImageNumber,
  getPositionOfNode,
  getYRotation,
} from "./utils";
import { checkPoint } from "./validators/pointValidator";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import React from "react";

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
  setCurrentPoint: React.Dispatch<React.SetStateAction<PointData>>,
  setCurrentImage: React.Dispatch<React.SetStateAction<string>>,
  setHotspots: React.Dispatch<React.SetStateAction<HotspotObj[]>>,
  setCurrentPosition: React.Dispatch<React.SetStateAction<THREE.Vector3>>,
  setRotation: React.Dispatch<React.SetStateAction<ThreeNumbersArray>>
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

/**
 * Update what point data and point image is being used
 * @param point
 * @param setCurrentPoint
 * @param setCurrentImage
 * @returns
 */
export function updatePoint(
  point: PointData,
  setCurrentPoint: React.Dispatch<React.SetStateAction<PointData>>,
  setCurrentImage: React.Dispatch<React.SetStateAction<string>>
) {
  if (!checkPoint(point)) {
    console.error("Invalid point:" + JSON.stringify(point));
    return;
  }

  setCurrentPoint(point);
  setCurrentImage(getPointAsImageNumber(point));
}

/**
 * Convert neighbour data into displayable hotspots
 * @param neighbours
 * @param setHotspots
 * @returns
 */
export function updateHotSpots(
  neighbours: NeighbourData[],
  setHotspots: React.Dispatch<React.SetStateAction<HotspotObj[]>>
) {
  if (!Array.isArray(neighbours)) {
    console.warn("Invalid neighbours:" + JSON.stringify(neighbours));
    return;
  }
  if (neighbours.length === 0) {
    setHotspots([]);
    return;
  }

  const newHotspots = neighbours
    .map((neighbour) => {
      if (!checkPoint(neighbour, false)) {
        console.warn("Invalid hotspot:" + JSON.stringify(neighbour));
        return null;
      }

      const pos = getPositionOfNode(neighbour);
      const m = new THREE.Matrix4();

      //@ts-expect-error - neighbour.pose is in the right format
      m.set(...neighbour.pose);

      const returnValue: HotspotObj = {
        position: [pos[0], pos[1], pos[2]],
        rotation: [0, getYRotation(neighbour.pose), 0],
        pose: m,
        id: neighbour.keyframe_id,
        ts: neighbour.ts,
      };
      return returnValue;
    })
    .filter((v) => v !== null);

  setHotspots(newHotspots);
}

/**
 * Update the XYZ rotation
 * @param point
 * @param setRotation
 * @returns
 */
export function updateRotation(
  point: PointData,
  setRotation: React.Dispatch<React.SetStateAction<ThreeNumbersArray>>
) {
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
  setCurrentPosition: React.Dispatch<React.SetStateAction<THREE.Vector3>>
) {
  if (!checkPoint(point)) {
    console.warn("Invalid hotspot:" + JSON.stringify(point));
    return;
  }

  const newPosition = getPositionOfNode(point);
  setCurrentPosition(new THREE.Vector3(...newPosition));
  camera.position.set(newPosition[0], newPosition[1], newPosition[2]);
}
