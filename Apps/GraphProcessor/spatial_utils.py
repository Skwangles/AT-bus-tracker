#!/usr/bin/env python3
"""
Spatial utilities for graph processing.

This module provides efficient spatial operations including proximity queries,
spatial indexing, and coverage calculations for graph pruning operations.
"""

import numpy as np
from typing import List, Tuple, Dict, Set, Optional
from scipy.spatial import cKDTree
from scipy.spatial.distance import cdist
import math
import logging

logger = logging.getLogger(__name__)

class SpatialIndex:
    """
    Efficient spatial index for proximity queries.
    
    This class provides fast spatial operations using KD-trees for
    finding nearby points and spatial relationships.
    """
    
    def __init__(self, positions: List[Tuple[float, float, float]], node_ids: List[int]):
        """
        Initialize spatial index with node positions.
        
        Args:
            positions: List of (x, y, z) positions
            node_ids: List of corresponding node IDs
        """
        self.positions = np.array(positions)
        self.node_ids = node_ids
        self.tree = cKDTree(self.positions)
        
        # Create mapping between indices and node IDs
        self.index_to_node_id = {i: node_id for i, node_id in enumerate(node_ids)}
        self.node_id_to_index = {node_id: i for i, node_id in enumerate(node_ids)}
    
    def find_neighbors_within_distance(self, point: Tuple[float, float, float], distance: float) -> List[int]:
        """
        Find all nodes within a specified distance of a point.
        
        Args:
            point: (x, y, z) coordinates
            distance: Maximum distance to search
            
        Returns:
            List of node IDs within the distance
        """
        indices = self.tree.query_ball_point(point, distance)
        return [self.index_to_node_id[i] for i in indices]
    
    def find_k_nearest_neighbors(self, point: Tuple[float, float, float], k: int) -> List[Tuple[int, float]]:
        """
        Find k nearest neighbors to a point.
        
        Args:
            point: (x, y, z) coordinates
            k: Number of nearest neighbors to find
            
        Returns:
            List of (node_id, distance) tuples
        """
        distances, indices = self.tree.query(point, k=min(k, len(self.positions)))
        
        if k == 1:
            return [(self.index_to_node_id[indices], distances)]
        else:
            return [(self.index_to_node_id[indices[i]], distances[i]) for i in range(len(indices))]
    
    def find_pairs_within_distance(self, distance: float) -> List[Tuple[int, int, float]]:
        """
        Find all pairs of nodes within a specified distance.
        
        Args:
            distance: Maximum distance between pairs
            
        Returns:
            List of (node1_id, node2_id, distance) tuples
        """
        pairs = self.tree.query_pairs(distance)
        result = []
        
        for i, j in pairs:
            node1_id = self.index_to_node_id[i]
            node2_id = self.index_to_node_id[j]
            actual_distance = math.sqrt(np.sum((self.positions[i] - self.positions[j])**2))
            result.append((node1_id, node2_id, actual_distance))
        
        return result

def calculate_3d_distance(point1: Tuple[float, float, float], point2: Tuple[float, float, float]) -> float:
    """
    Calculate 3D Euclidean distance between two points.
    
    Args:
        point1: First point (x, y, z)
        point2: Second point (x, y, z)
        
    Returns:
        Euclidean distance
    """
    return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2 + (point1[2] - point2[2])**2)

def calculate_2d_distance(point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
    """
    Calculate 2D Euclidean distance between two points.
    
    Args:
        point1: First point (x, y)
        point2: Second point (x, y)
        
    Returns:
        Euclidean distance
    """
    return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)

def find_bounding_box(positions: List[Tuple[float, float, float]]) -> Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]]:
    """
    Find the bounding box of a set of positions.
    
    Args:
        positions: List of (x, y, z) positions
        
    Returns:
        Tuple of ((min_x, max_x), (min_y, max_y), (min_z, max_z))
    """
    if not positions:
        return ((0, 0), (0, 0), (0, 0))
    
    x_coords = [pos[0] for pos in positions]
    y_coords = [pos[1] for pos in positions]
    z_coords = [pos[2] for pos in positions]
    
    return (
        (min(x_coords), max(x_coords)),
        (min(y_coords), max(y_coords)),
        (min(z_coords), max(z_coords))
    )

def generate_grid_points(bounding_box: Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]], 
                        step: float = 2.0) -> List[Tuple[float, float, float]]:
    """
    Generate a grid of test points within a bounding box.
    
    Args:
        bounding_box: Bounding box as ((min_x, max_x), (min_y, max_y), (min_z, max_z))
        step: Grid step size
        
    Returns:
        List of grid points
    """
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = bounding_box
    
    points = []
    for x in np.arange(min_x, max_x + step, step):
        for y in np.arange(min_y, max_y + step, step):
            for z in np.arange(min_z, max_z + step, step):
                points.append((x, y, z))
    
    return points

def calculate_coverage_score(positions: List[Tuple[float, float, float]], 
                           test_points: List[Tuple[float, float, float]], 
                           coverage_distance: float) -> float:
    """
    Calculate coverage score based on test points.
    
    Args:
        positions: List of node positions
        test_points: List of test points to check coverage
        coverage_distance: Distance within which a point is considered covered
        
    Returns:
        Coverage score (0.0 to 1.0)
    """
    if not test_points:
        return 0.0
    
    covered_points = 0
    for test_point in test_points:
        for position in positions:
            if calculate_3d_distance(test_point, position) <= coverage_distance:
                covered_points += 1
                break
    
    return covered_points / len(test_points)

def find_parallel_paths(graph: 'nx.Graph', positions: Dict[int, Tuple[float, float, float]], 
                       similarity_threshold: float = 0.8) -> List[Tuple[List[int], List[int]]]:
    """
    Find parallel paths in the graph.
    
    Args:
        graph: NetworkX graph
        positions: Dictionary mapping node IDs to positions
        similarity_threshold: Threshold for path similarity
        
    Returns:
        List of parallel path pairs
    """
    # This is a simplified implementation
    # A more sophisticated approach would use path similarity metrics
    
    parallel_paths = []
    
    # Find all simple paths between pairs of nodes
    nodes = list(graph.nodes())
    
    for i, start_node in enumerate(nodes):
        for end_node in nodes[i+1:]:
            try:
                # Find all simple paths between start and end
                all_paths = list(nx.all_simple_paths(graph, start_node, end_node))
                
                if len(all_paths) >= 2:
                    # Check if paths are parallel (similar length and direction)
                    for j, path1 in enumerate(all_paths):
                        for path2 in all_paths[j+1:]:
                            if _are_paths_parallel(path1, path2, positions, similarity_threshold):
                                parallel_paths.append((path1, path2))
            
            except nx.NetworkXNoPath:
                continue
    
    return parallel_paths

def _are_paths_parallel(path1: List[int], path2: List[int], 
                       positions: Dict[int, Tuple[float, float, float]], 
                       threshold: float) -> bool:
    """
    Check if two paths are parallel.
    
    Args:
        path1: First path (list of node IDs)
        path2: Second path (list of node IDs)
        positions: Dictionary mapping node IDs to positions
        threshold: Similarity threshold
        
    Returns:
        True if paths are parallel
    """
    if len(path1) < 2 or len(path2) < 2:
        return False
    
    # Calculate path directions
    dir1 = _calculate_path_direction(path1, positions)
    dir2 = _calculate_path_direction(path2, positions)
    
    # Calculate similarity (dot product of normalized directions)
    similarity = abs(np.dot(dir1, dir2))
    
    return similarity >= threshold

def _calculate_path_direction(path: List[int], positions: Dict[int, Tuple[float, float, float]]) -> np.ndarray:
    """
    Calculate the overall direction of a path.
    
    Args:
        path: List of node IDs
        positions: Dictionary mapping node IDs to positions
        
    Returns:
        Normalized direction vector
    """
    if len(path) < 2:
        return np.array([0, 0, 0])
    
    start_pos = positions[path[0]]
    end_pos = positions[path[-1]]
    
    direction = np.array([
        end_pos[0] - start_pos[0],
        end_pos[1] - start_pos[1],
        end_pos[2] - start_pos[2]
    ])
    
    # Normalize
    norm = np.linalg.norm(direction)
    if norm > 0:
        direction = direction / norm
    
    return direction

def optimize_node_selection(cluster_positions: List[Tuple[float, float, float]], 
                          cluster_node_ids: List[int],
                          graph: 'nx.Graph') -> int:
    """
    Optimize node selection for a cluster based on multiple criteria.
    
    Args:
        cluster_positions: Positions of nodes in the cluster
        cluster_node_ids: Node IDs in the cluster
        graph: NetworkX graph
        
    Returns:
        Best node ID to represent the cluster
    """
    if len(cluster_node_ids) == 1:
        return cluster_node_ids[0]
    
    # Calculate centroid
    centroid = (
        np.mean([pos[0] for pos in cluster_positions]),
        np.mean([pos[1] for pos in cluster_positions]),
        np.mean([pos[2] for pos in cluster_positions])
    )
    
    # Score each node based on multiple criteria
    best_score = float('-inf')
    best_node_id = cluster_node_ids[0]
    
    for i, node_id in enumerate(cluster_node_ids):
        position = cluster_positions[i]
        
        # Criterion 1: Distance to centroid (closer is better)
        centroid_distance = calculate_3d_distance(position, centroid)
        centroid_score = -centroid_distance
        
        # Criterion 2: Degree in graph (higher is better)
        degree = graph.degree(node_id) if graph.has_node(node_id) else 0
        degree_score = degree
        
        # Criterion 3: Centrality (could be enhanced with betweenness centrality)
        centrality_score = 0  # Placeholder for more sophisticated centrality
        
        # Combined score (weighted sum)
        total_score = centroid_score + 0.5 * degree_score + 0.1 * centrality_score
        
        if total_score > best_score:
            best_score = total_score
            best_node_id = node_id
    
    return best_node_id


