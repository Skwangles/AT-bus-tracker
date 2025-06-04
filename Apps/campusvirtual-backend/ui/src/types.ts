import * as THREE from "three";

export interface Label {
  query: string;
  label: string;
  type: LabelType;
  parents: string[];
  children: Label[];
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
}

export enum LabelType {
  Normal = 0,
  Toilet,
  Elevator,
  GroupName
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

export interface FloorGroup {
  name: string;  // Floor name (B, G, 1, 2, etc.)
  order: number; // For sorting (B=-1, G=0, 1=1, 2=2, etc.)
  items: {
    rooms: Label[];
    elevators: Label[];
    toilets: Label[];
  };
}
