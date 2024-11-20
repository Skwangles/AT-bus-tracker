import { create } from 'zustand';
import { Node, Edge, Location } from './types';
import { DatabaseAdapter } from './db/types';
import { SQLiteAdapter } from './db/sqlite';
import { ApiAdapter } from './db/api';
import { ApiConfig } from './api/types';
import { findPath } from './utils/pathfinding';

interface TourState {
  nodes: Node[];
  edges: Edge[];
  locations: Location[];
  currentNode: Node | null;
  pathNodes: Node[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  dbAdapter: DatabaseAdapter | null;
  initialize: (useApi?: boolean, apiConfig?: ApiConfig) => Promise<void>;
  setCurrentNode: (nodeId: number) => void;
  getNeighbors: (nodeId: number) => Node[];
  findPathToLocation: (locationId: number) => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  nodes: [],
  edges: [],
  locations: [],
  currentNode: null,
  pathNodes: [],
  loading: false,
  error: null,
  initialized: false,
  dbAdapter: null,

  initialize: async (useApi = false, apiConfig?: ApiConfig) => {
    try {
      set({ loading: true });

      if (get().dbAdapter) {
        await get().dbAdapter.close();
      }

      const adapter = useApi && apiConfig
        ? new ApiAdapter(apiConfig)
        : new SQLiteAdapter();

      await adapter.initialize();

      const [locations, nodes, edges] = await Promise.all([
        adapter.getLocations(),
        adapter.getNodes(),
        adapter.getEdges(),
      ]);

      set({
        dbAdapter: adapter,
        nodes,
        edges,
        locations,
        currentNode: nodes[0],
        initialized: true,
        loading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setCurrentNode: (nodeId: number) => {
    const { nodes, pathNodes } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      set({ currentNode: node });
      
      if (pathNodes.length > 0 && pathNodes[0].id === nodeId) {
        set({ pathNodes: pathNodes.slice(1) });
      }
    }
  },

  getNeighbors: (nodeId: number) => {
    const { nodes, edges } = get();
    const neighborIds = edges
      .filter(edge => edge.fromNodeId === nodeId)
      .map(edge => edge.toNodeId);
    return nodes.filter(node => neighborIds.includes(node.id));
  },

  findPathToLocation: (locationId: number) => {
    const { nodes, currentNode } = get();
    if (!currentNode) return;

    const targetNodes = nodes.filter(n => n.locationId === locationId);
    if (targetNodes.length === 0) return;

    const targetNode = targetNodes[Math.floor(Math.random() * targetNodes.length)];
    const path = findPath(currentNode, targetNode, nodes, get().edges);
    set({ pathNodes: path.slice(1) });
  },
}));