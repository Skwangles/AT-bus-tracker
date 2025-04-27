import * as THREE from "three";

export interface Label {
  query: string; // query to search the database
  label: string; // the actual label to be used
  group?: string; // the shared location with potentially other labels with the same location
  type: number; // 0 = Normal, 1 = Toilet, 2 = Elevator
}

export enum LabelType {
  Normal = 0,
  Toilet,
  Elevator,
  Group,
}

export enum ReservedTypeIndex {
  Anchor = 0,
  Elevator,
  Toilet,
  MergePoint,
}

export enum MoveDirectionType {
  Forward = 0,
  Backward,
  Left,
  Right,
}

export interface HotspotObj {
  pose: THREE.Matrix4;
  position: ThreeNumbersArray;
  rotation: ThreeNumbersArray;
  id: string;
  ts: string;
}

export interface PointData {
  pose: number[];
  ts: string;
  keyframe_id: number;
  x_trans: number;
  y_trans: number;
  z_trans: number;
  location: string;
}

export interface NeighbourData {
  pose: number[];
  ts: string;
  keyframe_id: string;
  x_trans: number;
  y_trans: number;
  z_trans: number;
}

export type ThreeNumbersArray = [number, number, number];

export interface RotationData {
  yaw: number;
  pitch: number;
}
