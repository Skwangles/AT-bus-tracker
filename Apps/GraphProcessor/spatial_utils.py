"""
Minimal spatial utilities for graph processing.
Contains only the functions actually used by the remaining code.
"""

import numpy as np
from typing import Dict, List, Tuple, Set
import math


def calculate_3d_distance(pos1: Tuple[float, float, float], pos2: Tuple[float, float, float]) -> float:
    """
    Calculate 3D Euclidean distance between two points.
    
    Args:
        pos1: First point (x, y, z)
        pos2: Second point (x, y, z)
        
    Returns:
        Distance in metres
    """
    x1, y1, z1 = pos1
    x2, y2, z2 = pos2
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2 + (z2 - z1)**2)


def find_bounding_box(node_positions) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
    """
    Find the bounding box of all nodes.
    
    Args:
        node_positions: Either a dictionary mapping node IDs to position dictionaries,
                       or a list of (x, y, z) coordinate tuples
        
    Returns:
        Tuple of (min_coords, max_coords) where each is (x, y, z)
    """
    if not node_positions:
        return ((0, 0, 0), (0, 0, 0))
    
    # Handle list format: [(x1, y1, z1), (x2, y2, z2), ...]
    elif isinstance(node_positions, list):
        min_x = min(pos[0] for pos in node_positions)
        min_y = min(pos[1] for pos in node_positions)
        min_z = min(pos[2] for pos in node_positions)
        
        max_x = max(pos[0] for pos in node_positions)
        max_y = max(pos[1] for pos in node_positions)
        max_z = max(pos[2] for pos in node_positions)
    
    else:
        raise ValueError(f"Unsupported data type: {type(node_positions)}. Expected dict or list.")
    
    return ((min_x, min_y, min_z), (max_x, max_y, max_z))


def generate_grid_points(bounding_box: Tuple[Tuple[float, float, float], Tuple[float, float, float]], 
                        grid_step: float) -> List[Tuple[float, float, float]]:
    """
    Generate a grid of test points within the bounding box.
    
    Args:
        bounding_box: Tuple of (min_coords, max_coords)
        grid_step: Distance between grid points
        
    Returns:
        List of (x, y, z) coordinates for test points
    """
    (min_x, min_y, min_z), (max_x, max_y, max_z) = bounding_box
    
    x_coords = np.arange(min_x, max_x + grid_step, grid_step)
    y_coords = np.arange(min_y, max_y + grid_step, grid_step)
    z_coords = np.arange(min_z, max_z + grid_step, grid_step)
    
    test_points = []
    for x in x_coords:
        for y in y_coords:
            for z in z_coords:
                test_points.append((float(x), float(y), float(z)))
    
    return test_points
