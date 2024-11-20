import { Node, Edge, Location } from '../types';

export interface DatabaseAdapter {
  initialize(): Promise<void>;
  getLocations(): Promise<Location[]>;
  getNodes(): Promise<Node[]>;
  getEdges(): Promise<Edge[]>;
  close(): Promise<void>;
}