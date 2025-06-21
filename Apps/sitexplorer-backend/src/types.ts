export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export enum LabelType {
  Normal = 0,
  Toilet,
  Elevator,
  GroupName
}

export interface PointData {
  id: number;
  x: number;
  y: number;
  z: number;
  type: number;
  label?: string;
  groups?: string[];
  shaft?: string;
}

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

export interface LocationGroup {
  id: number;
  name: string;
  description?: string;
} 

export type ThreeNumbersArray = [number, number, number];