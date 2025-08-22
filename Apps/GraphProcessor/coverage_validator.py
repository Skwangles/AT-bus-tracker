#!/usr/bin/env python3
"""
Coverage validation for graph pruning.

This module provides tools to validate that the pruned graph maintains
adequate coverage of the space, ensuring no point is more than 5m from a node.
"""

import numpy as np
from typing import List, Tuple, Dict, Set, Optional
import math
import logging
from scipy.spatial import cKDTree

from spatial_utils import find_bounding_box, generate_grid_points, calculate_3d_distance

logger = logging.getLogger(__name__)

class CoverageValidator:
    """
    Validates coverage of a graph to ensure adequate spatial coverage.
    
    This class provides methods to check if a graph provides sufficient
    coverage of the space, typically ensuring no point is more than 5m
    from any node.
    """
    
    def __init__(self, coverage_distance: float = 5.0, grid_step: float = 2.0):
        """
        Initialize the coverage validator.
        
        Args:
            coverage_distance: Maximum distance any point should be from a node
            grid_step: Step size for generating test grid points
        """
        self.coverage_distance = coverage_distance
        self.grid_step = grid_step
        self.spatial_tree: Optional[cKDTree] = None
        self.node_positions: List[Tuple[float, float, float]] = []
        self.node_ids: List[int] = []
    
    def set_graph_data(self, nodes: Dict[int, Dict[str, float]]):
        """
        Set the graph data for coverage validation.
        
        Args:
            nodes: Dictionary mapping node IDs to node data with 'x', 'y', 'z' keys
        """
        self.node_positions = []
        self.node_ids = []
        
        for node_id, node_data in nodes.items():
            self.node_positions.append((node_data['x'], node_data['y'], node_data['z']))
            self.node_ids.append(node_id)
        
        if self.node_positions:
            self.spatial_tree = cKDTree(self.node_positions)
    
    def validate_coverage(self) -> Tuple[bool, float, List[Tuple[float, float, float]]]:
        """
        Validate that the graph provides adequate coverage.
        
        Returns:
            Tuple of (is_covered, coverage_score, uncovered_points)
        """
        if not self.node_positions:
            return False, 0.0, []
        
        # Generate test points
        bounding_box = find_bounding_box(self.node_positions)
        test_points = generate_grid_points(bounding_box, self.grid_step)
        
        if not test_points:
            return True, 1.0, []
        
        # Check coverage
        uncovered_points = []
        covered_count = 0
        
        for test_point in test_points:
            if self._is_point_covered(test_point):
                covered_count += 1
            else:
                uncovered_points.append(test_point)
        
        coverage_score = covered_count / len(test_points)
        is_covered = coverage_score >= 0.95  # 95% coverage threshold (hardcoded for now)
        
        logger.info(f"Coverage validation: {coverage_score:.3f} ({covered_count}/{len(test_points)} points covered)")
        
        return is_covered, coverage_score, uncovered_points
    
    def _is_point_covered(self, point: Tuple[float, float, float]) -> bool:
        """
        Check if a specific point is covered by any node.
        
        Args:
            point: (x, y, z) coordinates to check
            
        Returns:
            True if point is within coverage_distance of any node
        """
        if not self.spatial_tree:
            return False
        
        # Find nearest neighbor
        distance, _ = self.spatial_tree.query(point)
        return distance <= self.coverage_distance
    
    def find_coverage_gaps(self, min_gap_size: float = 2.0) -> List[Tuple[float, float, float]]:
        """
        Find significant coverage gaps in the graph.
        
        Args:
            min_gap_size: Minimum size of gap to report
            
        Returns:
            List of points representing coverage gaps
        """
        if not self.node_positions:
            return []
        
        # Generate test points
        bounding_box = find_bounding_box(self.node_positions)
        test_points = generate_grid_points(bounding_box, self.grid_step)
        
        gaps = []
        for test_point in test_points:
            if not self._is_point_covered(test_point):
                # Check if this is part of a significant gap
                if self._is_significant_gap(test_point, min_gap_size):
                    gaps.append(test_point)
        
        return gaps
    
    def _is_significant_gap(self, point: Tuple[float, float, float], min_gap_size: float) -> bool:
        """
        Check if a point is part of a significant coverage gap.
        
        Args:
            point: Point to check
            min_gap_size: Minimum gap size to consider significant
            
        Returns:
            True if point is part of a significant gap
        """
        # Check if there are multiple uncovered points nearby
        nearby_uncovered = 0
        
        # Check points in a small radius around this point
        check_radius = min_gap_size / 2
        
        for dx in np.arange(-check_radius, check_radius + self.grid_step, self.grid_step):
            for dy in np.arange(-check_radius, check_radius + self.grid_step, self.grid_step):
                for dz in np.arange(-check_radius, check_radius + self.grid_step, self.grid_step):
                    check_point = (point[0] + dx, point[1] + dy, point[2] + dz)
                    if not self._is_point_covered(check_point):
                        nearby_uncovered += 1
        
        # Consider it significant if there are multiple uncovered points nearby
        return nearby_uncovered >= 3
    
    def suggest_coverage_improvements(self, uncovered_points: List[Tuple[float, float, float]]) -> List[Tuple[float, float, float]]:
        """
        Suggest optimal positions for additional nodes to improve coverage.
        
        Args:
            uncovered_points: List of uncovered points
            
        Returns:
            List of suggested node positions
        """
        if not uncovered_points:
            return []
        
        # Group uncovered points into clusters
        uncovered_array = np.array(uncovered_points)
        
        # Use DBSCAN to cluster uncovered points
        from sklearn.cluster import DBSCAN
        clustering = DBSCAN(eps=self.coverage_distance, min_samples=1).fit(uncovered_array)
        
        # Find cluster centers
        suggested_positions = []
        unique_labels = set(clustering.labels_)
        
        for label in unique_labels:
            if label == -1:  # Noise points
                continue
            
            # Get points in this cluster
            cluster_points = uncovered_array[clustering.labels_ == label]
            
            # Calculate cluster center
            center = np.mean(cluster_points, axis=0)
            suggested_positions.append(tuple(center))
        
        logger.info(f"Suggested {len(suggested_positions)} additional node positions for coverage improvement")
        
        return suggested_positions
    
    def calculate_coverage_statistics(self) -> Dict[str, float]:
        """
        Calculate detailed coverage statistics.
        
        Returns:
            Dictionary with coverage statistics
        """
        if not self.node_positions:
            return {
                'coverage_score': 0.0,
                'average_distance_to_nearest_node': float('inf'),
                'max_distance_to_nearest_node': float('inf'),
                'min_distance_to_nearest_node': float('inf'),
                'total_test_points': 0,
                'covered_points': 0,
                'uncovered_points': 0
            }
        
        # Generate test points
        bounding_box = find_bounding_box(self.node_positions)
        test_points = generate_grid_points(bounding_box, self.grid_step)
        
        if not test_points:
            return {
                'coverage_score': 1.0,
                'average_distance_to_nearest_node': 0.0,
                'max_distance_to_nearest_node': 0.0,
                'min_distance_to_nearest_node': 0.0,
                'total_test_points': 0,
                'covered_points': 0,
                'uncovered_points': 0
            }
        
        # Calculate distances to nearest nodes
        distances = []
        covered_count = 0
        
        for test_point in test_points:
            if self.spatial_tree:
                distance, _ = self.spatial_tree.query(test_point)
                distances.append(distance)
                
                if distance <= self.coverage_distance:
                    covered_count += 1
        
        distances = np.array(distances)
        
        return {
            'coverage_score': covered_count / len(test_points),
            'average_distance_to_nearest_node': float(np.mean(distances)),
            'max_distance_to_nearest_node': float(np.max(distances)),
            'min_distance_to_nearest_node': float(np.min(distances)),
            'total_test_points': len(test_points),
            'covered_points': covered_count,
            'uncovered_points': len(test_points) - covered_count
        }
    
    def validate_coverage_with_tolerance(self, tolerance: float = 0.05) -> Tuple[bool, Dict[str, float]]:
        """
        Validate coverage with a tolerance for small gaps.
        
        Args:
            tolerance: Tolerance for coverage (e.g., 0.05 means 95% coverage is acceptable)
            
        Returns:
            Tuple of (is_acceptable, statistics)
        """
        stats = self.calculate_coverage_statistics()
        is_acceptable = stats['coverage_score'] >= (1.0 - tolerance)
        
        return is_acceptable, stats
    
    def generate_coverage_report(self) -> str:
        """
        Generate a detailed coverage report.
        
        Returns:
            Formatted coverage report string
        """
        stats = self.calculate_coverage_statistics()
        
        report = f"""
Coverage Report
===============
Coverage Score: {stats['coverage_score']:.3f} ({stats['covered_points']}/{stats['total_test_points']} points)
Average Distance to Nearest Node: {stats['average_distance_to_nearest_node']:.2f}m
Maximum Distance to Nearest Node: {stats['max_distance_to_nearest_node']:.2f}m
Minimum Distance to Nearest Node: {stats['min_distance_to_nearest_node']:.2f}m
Coverage Distance: {self.coverage_distance}m
Grid Step: {self.grid_step}m

Coverage Assessment: {'✓ PASS' if stats['coverage_score'] >= 0.95 else '✗ FAIL'}
"""
        
        return report



