import { Node, PathNode, Edge } from '../types';

export function findPath(
  start: Node,
  end: Node,
  nodes: Node[],
  edges: Edge[]
): Node[] {
  const openSet: PathNode[] = [];
  const closedSet: Set<number> = new Set();
  
  openSet.push({
    node: start,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
  });

  while (openSet.length > 0) {
    const current = openSet.reduce((min, item) => 
      item.f < min.f ? item : min, openSet[0]);
    
    if (current.node.id === end.id) {
      return reconstructPath(current);
    }

    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(current.node.id);

    const neighbors = getNeighbors(current.node, nodes, edges);

    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.id)) continue;

      const g = current.g + distance(current.node, neighbor);
      
      const existingNeighbor = openSet.find(n => n.node.id === neighbor.id);
      
      if (!existingNeighbor) {
        openSet.push({
          node: neighbor,
          g,
          h: heuristic(neighbor, end),
          f: g + heuristic(neighbor, end),
          parent: current
        });
      } else if (g < existingNeighbor.g) {
        existingNeighbor.g = g;
        existingNeighbor.f = g + existingNeighbor.h;
        existingNeighbor.parent = current;
      }
    }
  }

  return [];
}

function heuristic(a: Node, b: Node): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function distance(a: Node, b: Node): number {
  return heuristic(a, b);
}

function getNeighbors(node: Node, nodes: Node[], edges: Edge[]): Node[] {
  const neighborEdges = edges.filter(e => e.fromNodeId === node.id);
  return nodes.filter(n => neighborEdges.some(e => e.toNodeId === n.id));
}

function reconstructPath(endNode: PathNode): Node[] {
  const path: Node[] = [];
  let current: PathNode | undefined = endNode;
  
  while (current) {
    path.unshift(current.node);
    current = current.parent;
  }
  
  return path;
}