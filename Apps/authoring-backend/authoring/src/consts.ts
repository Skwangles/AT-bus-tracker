export const API_PREFIX = "http://localhost:3002"
export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;

export interface Node {
  id: string;
  x: number;
  y: number;
  type: number;
}

export interface Edge {
  id0: string;
  id1: string;
}
