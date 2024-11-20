export interface Node {
  id: number;
  name: string;
  imageUrl: string;
  x: number;
  y: number;
  z: number;
  locationId: number;
  mapX: number;
  mapY: number;
}

export interface Edge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
}

export interface Location {
  id: number;
  name: string;
  mapImage: string;
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface PathNode {
  node: Node;
  g: number;
  h: number;
  f: number;
  parent?: PathNode;
}