import { COORDS_TO_METRES } from "../consts";
import * as THREE from "three";
import { NeighbourData, PointData, ThreeNumbersArray } from "../types";

export function inv(pose: number[][]) {
  if (
    !pose ||
    pose.length !== 4 ||
    pose[0].length !== 4 ||
    pose[1].length !== 4 ||
    pose[2].length !== 4 ||
    pose[3].length !== 4
  ) {
    throw new Error("Invalid pose size. Expected a 4x4 matrix.");
  }

  const res: number[][] = [];
  for (let i = 0; i < 3; i++) {
    res.push([0, 0, 0, 0]);
  }
  // - R^T * t
  res[0][3] =
    -pose[0][0] * pose[0][3] -
    pose[1][0] * pose[1][3] -
    pose[2][0] * pose[2][3];
  res[1][3] =
    -pose[0][1] * pose[0][3] -
    pose[1][1] * pose[1][3] -
    pose[2][1] * pose[2][3];
  res[2][3] =
    -pose[0][2] * pose[0][3] -
    pose[1][2] * pose[1][3] -
    pose[2][2] * pose[2][3];
  res[0][0] = pose[0][0];
  res[0][1] = pose[1][0];
  res[0][2] = pose[2][0];
  res[1][0] = pose[0][1];
  res[1][1] = pose[1][1];
  res[1][2] = pose[2][1];
  res[2][0] = pose[0][2];
  res[2][1] = pose[1][2];
  res[2][2] = pose[2][2];

  return res;
}

// function that converts array that have size of 16 to matrix that shape of 4x4
export function array2mat44(mat, array: number[]) {
  for (let i = 0; i < 4; i++) {
    const raw: number[] = [];
    for (let j = 0; j < 4; j++) {
      const k = i * 4 + j;
      const elm = array[k];
      raw.push(elm);
    }
    mat.push(raw);
  }
}

const USE_TRANS = true;
export function getPositionOfNode(point: {
  pose: number[];
  x_trans: number;
  y_trans: number;
  z_trans: number;
}): ThreeNumbersArray {
  if (USE_TRANS) {
    return [
      -point.x_trans * COORDS_TO_METRES,
      -point.y_trans * COORDS_TO_METRES,
      point.z_trans * COORDS_TO_METRES,
    ];
  }
  return calculatePositionFromMatrix(point.pose);
}

export const calculatePositionFromMatrix = (
  matrix: number[]
): ThreeNumbersArray => {
  const m = new THREE.Matrix4();
  //@ts-expect-error It is in the right format
  m.set(...matrix);
  m.invert();
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(m);
  return [
    -position.x * COORDS_TO_METRES,
    -position.y * COORDS_TO_METRES,
    position.z * COORDS_TO_METRES,
  ];
};

export const getYRotation = (matrix: number[]) => {
  // Ensure the matrix is 4x4
  if (matrix.length !== 16) {
    console.error("Invalid matrix size. Expected a 4x4 matrix", matrix);
    throw new Error("Invalid matrix size. Expected a 4x4 matrix.");
  }

  // Extract the relevant elements
  const m11 = matrix[0];
  const m31 = matrix[8];

  // Calculate the rotation angle around the Y-axis
  const rotationY = Math.atan2(m31, m11);

  return -rotationY; // Rotation in radians
};

export function getPointAsImageNumber(point: { ts: number | string }): string {
  return Number(point.ts).toFixed(5);
}
