export const API_PREFIX = ""
export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;

export interface Node {
  id: string;
  x: number;
  y: number;
  type: number;
  labelCount?: number;
}

export interface Edge {
  id0: string;
  id1: string;
}
