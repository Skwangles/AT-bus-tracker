#!/usr/bin/env python3
"""
Advanced Graph Pruner for building walkable paths.

This module implements sophisticated pruning algorithms using hierarchical clustering,
minimum spanning trees, and multi-objective optimisation to reduce graph complexity
while maintaining connectivity and coverage.
"""

import numpy as np
import networkx as nx
from typing import List, Tuple, Dict, Set, Optional, NamedTuple, Any
from dataclasses import dataclass
from collections import defaultdict, deque
import math
import logging
from scipy.spatial.distance import cdist
from scipy.spatial import cKDTree
from sklearn.cluster import DBSCAN
from tqdm import tqdm

from config import Config, EdgeType, NodeType
from db_manager import DatabaseManager

logger = logging.getLogger(__name__)

@dataclass
class ClusterInfo:
    """Information about a spatial cluster of nodes."""
    cluster_id: int
    node_ids: List[int]
    representative_id: int
    centroid: Tuple[float, float, float]
    radius: float

@dataclass
class PruningResult:
    """Result of a pruning operation."""
    nodes_removed: int
    edges_removed: int
    edges_added: int
    coverage_score: float
    connectivity_maintained: bool
    max_hop_distance: float

class AdvancedGraphPruner:
    """
    Advanced graph pruner using hierarchical clustering and MST-based approaches.
    
    This pruner implements multiple strategies to reduce graph complexity while
    maintaining connectivity and ensuring coverage within specified distances.
    """
    
    def __init__(self, config: Config, db_manager: DatabaseManager):
        """
        Initialize the advanced graph pruner.
        
        Args:
            config: Configuration object containing pruning parameters
            db_manager: Database manager for data access
        """
        self.config = config
        self.db_manager = db_manager
        self.nodes: Dict[int, Dict[str, Any]] = {}
        self.edges: List[Tuple[int, int]] = []
        self.graph: Optional[nx.Graph] = None
        self.spatial_tree: Optional[cKDTree] = None
        
    def load_graph_data(self):
        """Load graph data from database."""
        logger.info("Loading graph data from database...")
        
        # Load nodes
        nodes_data = self.db_manager.execute_query(
            "SELECT keyframe_id, x_trans, y_trans, z_trans, ts, zone FROM nodes"
        )
        
        logger.info(f"Found {len(nodes_data)} nodes in database")
        
        for row in nodes_data:
            self.nodes[row['keyframe_id']] = {
                'x': row['x_trans'],
                'y': row['y_trans'], 
                'z': row['z_trans'],
                'ts': row['ts'],
                'zone': row['zone']
            }
        
        logger.info(f"Loaded {len(self.nodes)} nodes into memory")
        
        # Load edges
        edges_data = self.db_manager.execute_query(
            "SELECT keyframe_id0, keyframe_id1 FROM edges"
        )
        
        logger.info(f"Found {len(edges_data)} edges in database")
        
        for row in edges_data:
            self.edges.append((row['keyframe_id0'], row['keyframe_id1']))
        
        logger.info(f"Loaded {len(self.edges)} edges into memory")
        
        logger.info(f"Loaded {len(self.nodes)} nodes and {len(self.edges)} edges")
        
        # Build spatial index
        self._build_spatial_index()
        
        # Build NetworkX graph
        self._build_networkx_graph()
    
    def _build_spatial_index(self):
        """Build spatial index for efficient proximity queries."""
        positions = []
        node_ids = []
        
        for node_id, node_data in self.nodes.items():
            positions.append([node_data['x'], node_data['y'], node_data['z']])
            node_ids.append(node_id)
        
        self.spatial_tree = cKDTree(positions)
        self.node_id_to_index = {node_id: i for i, node_id in enumerate(node_ids)}
        self.index_to_node_id = {i: node_id for i, node_id in enumerate(node_ids)}
    
    def _build_networkx_graph(self):
        """Build NetworkX graph from loaded data."""
        self.graph = nx.Graph()
        
        # Add nodes
        for node_id in self.nodes.keys():
            self.graph.add_node(node_id)
        
        # Add edges with weights (distances)
        for node1_id, node2_id in self.edges:
            if node1_id in self.nodes and node2_id in self.nodes:
                distance = self._calculate_distance(node1_id, node2_id)
                self.graph.add_edge(node1_id, node2_id, weight=distance)
    
    def _calculate_distance(self, node1_id: int, node2_id: int) -> float:
        """Calculate 3D Euclidean distance between two nodes."""
        node1 = self.nodes[node1_id]
        node2 = self.nodes[node2_id]
        
        # Scale coordinates by 15 to convert to meters
        scale_factor = 15.0
        
        return math.sqrt(
            (node1['x'] * scale_factor - node2['x'] * scale_factor)**2 + 
            (node1['y'] * scale_factor - node2['y'] * scale_factor)**2 + 
            (node1['z'] * scale_factor - node2['z'] * scale_factor)**2
        )
    
    def hierarchical_clustering_pruning(self, target_distance: float = 5.0) -> PruningResult:
        """
        Perform hierarchical clustering-based pruning with coverage optimization.
        
        Args:
            target_distance: Target distance for clustering (default: 5.0m)
            
        Returns:
            PruningResult with statistics
        """
        logger.info(f"Starting hierarchical clustering pruning with target distance: {target_distance}m")
        
        initial_nodes = len(self.nodes)
        initial_edges = len(self.edges)
        
        # Step 1: Start with conservative clustering and iteratively adjust
        best_result = None
        best_coverage = 0.0
        best_reduction = 0.0
        
        # Try different clustering distances to find optimal balance
        test_distances = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        
        for test_distance in test_distances:
            logger.info(f"Testing clustering distance: {test_distance}m")
            
            # Create a copy of the original data for testing
            test_nodes = self.nodes.copy()
            test_edges = self.edges.copy()
            test_graph = self.graph.copy() if self.graph else None
            
            # Form spatial clusters with test distance
            clusters = self._form_spatial_clusters(test_distance)
            representatives = self._select_cluster_representatives(clusters)
            
            # Calculate coverage with 5m requirement
            coverage_score = self._calculate_coverage_with_representatives(representatives, 5.0)
            reduction_ratio = len(representatives) / initial_nodes
            
            logger.info(f"  Clusters: {len(clusters)}, Coverage: {coverage_score:.3f}, Reduction: {reduction_ratio:.3f}")
            
            # Prefer solutions with good coverage (>80%) and reasonable reduction (>50%)
            if coverage_score >= 0.8 and reduction_ratio <= 0.5:
                if coverage_score > best_coverage or (coverage_score == best_coverage and reduction_ratio < best_reduction):
                    best_result = (test_distance, representatives, clusters, coverage_score, reduction_ratio)
                    best_coverage = coverage_score
                    best_reduction = reduction_ratio
        
        # If no good solution found, use the best coverage
        if best_result is None:
            for test_distance in test_distances:
                clusters = self._form_spatial_clusters(test_distance)
                representatives = self._select_cluster_representatives(clusters)
                coverage_score = self._calculate_coverage_with_representatives(representatives, 5.0)
                if coverage_score > best_coverage:
                    best_result = (test_distance, representatives, clusters, coverage_score, len(representatives) / initial_nodes)
                    best_coverage = coverage_score
        
        if best_result is None:
            # Fallback to original approach
            clusters = self._form_spatial_clusters(target_distance)
            representatives = self._select_cluster_representatives(clusters)
            coverage_score = self._calculate_coverage_score(target_distance)
        else:
            test_distance, representatives, clusters, coverage_score, reduction_ratio = best_result
            logger.info(f"Selected optimal clustering distance: {test_distance}m")
        
        # Store clusters for edge mapping
        self.clusters = clusters
        
        # Step 2: Remove non-representative nodes and update edge references
        nodes_removed = self._remove_non_representatives(representatives)
        logger.info(f"Removed {nodes_removed} non-representative nodes")
        
        # Step 3: Connect representatives while preserving connectivity (after edge mapping)
        edges_added = self._connect_representatives(representatives, clusters)
        logger.info(f"Added {edges_added} new edges between representatives")
        
        # Step 4: Clean up redundant edges
        edges_removed = self._cleanup_redundant_edges()
        logger.info(f"Removed {edges_removed} redundant edges")
        
        # Calculate final results
        connectivity_maintained = nx.is_connected(self.graph) if self.graph else False
        max_hop_distance = self._calculate_max_hop_distance()
        
        return PruningResult(
            nodes_removed=initial_nodes - len(self.nodes),
            edges_removed=initial_edges - len(self.edges) + edges_added,
            edges_added=edges_added,
            coverage_score=coverage_score,
            connectivity_maintained=connectivity_maintained,
            max_hop_distance=max_hop_distance
        )
    
    def _form_spatial_clusters(self, target_distance: float) -> List[ClusterInfo]:
        """Form spatial clusters using DBSCAN."""
        # Prepare data for clustering with scaling
        positions = []
        node_ids = []
        scale_factor = 15.0
        
        for node_id, node_data in self.nodes.items():
            positions.append([node_data['x'] * scale_factor, node_data['y'] * scale_factor, node_data['z'] * scale_factor])
            node_ids.append(node_id)
        
        positions = np.array(positions)
        
        # Use DBSCAN for clustering
        clustering = DBSCAN(eps=target_distance, min_samples=1).fit(positions)
        
        # Group nodes by cluster
        clusters = defaultdict(list)
        for i, cluster_id in enumerate(clustering.labels_):
            clusters[cluster_id].append(node_ids[i])
        
        # Convert to ClusterInfo objects
        cluster_infos = []
        for cluster_id, cluster_node_ids in clusters.items():
            if cluster_id == -1:  # Noise points (shouldn't happen with min_samples=1)
                continue
                
            # Calculate centroid (in scaled coordinates)
            cluster_positions = [self.nodes[node_id] for node_id in cluster_node_ids]
            scale_factor = 15.0
            centroid = (
                np.mean([pos['x'] * scale_factor for pos in cluster_positions]),
                np.mean([pos['y'] * scale_factor for pos in cluster_positions]),
                np.mean([pos['z'] * scale_factor for pos in cluster_positions])
            )
            
            # Calculate radius (in scaled coordinates)
            radius = max(
                math.sqrt((pos['x'] * scale_factor - centroid[0])**2 + 
                         (pos['y'] * scale_factor - centroid[1])**2 + 
                         (pos['z'] * scale_factor - centroid[2])**2)
                for pos in cluster_positions
            )
            
            # Select representative (node closest to centroid)
            representative_id = min(
                cluster_node_ids,
                key=lambda node_id: math.sqrt(
                    (self.nodes[node_id]['x'] * scale_factor - centroid[0])**2 +
                    (self.nodes[node_id]['y'] * scale_factor - centroid[1])**2 +
                    (self.nodes[node_id]['z'] * scale_factor - centroid[2])**2
                )
            )
            
            cluster_infos.append(ClusterInfo(
                cluster_id=cluster_id,
                node_ids=cluster_node_ids,
                representative_id=representative_id,
                centroid=centroid,
                radius=radius
            ))
        
        return cluster_infos
    
    def _select_cluster_representatives(self, clusters: List[ClusterInfo]) -> Set[int]:
        """Select representative nodes for each cluster."""
        representatives = set()
        
        for cluster in clusters:
            if len(cluster.node_ids) == 1:
                # Single node cluster - keep it
                representatives.add(cluster.representative_id)
            else:
                # Multi-node cluster - select best representative
                best_representative = self._select_best_representative(cluster)
                representatives.add(best_representative)
        
        return representatives
    
    def _select_best_representative(self, cluster: ClusterInfo) -> int:
        """Select the best representative node for a cluster."""
        # For now, use the node closest to centroid
        # Could be enhanced with additional criteria (degree, sharpness, etc.)
        return cluster.representative_id
    
    def _connect_representatives(self, representatives: Set[int], clusters: List[ClusterInfo]) -> int:
        """Connect representative nodes while preserving connectivity."""
        edges_added = 0
        
        # Build graph of representatives
        rep_graph = nx.Graph()
        for rep_id in representatives:
            rep_graph.add_node(rep_id)
        
        # Add edges between representatives that were connected in original graph
        # At this point, self.edges already contains the mapped representative edges
        for node1_id, node2_id in self.edges:
            distance = self._calculate_distance(node1_id, node2_id)
            rep_graph.add_edge(node1_id, node2_id, weight=distance)
        
        # If graph is not connected, add edges to connect components
        if not nx.is_connected(rep_graph):
            components = list(nx.connected_components(rep_graph))
            logger.info(f"Graph has {len(components)} disconnected components")
            
            for i in range(len(components) - 1):
                comp1 = list(components[i])
                comp2 = list(components[i + 1])
                
                # Find shortest edge between components
                min_distance = float('inf')
                best_edge = None
                
                for node1 in comp1:
                    for node2 in comp2:
                        distance = self._calculate_distance(node1, node2)
                        if distance < min_distance and distance <= 10.0:  # Max 10m connection
                            min_distance = distance
                            best_edge = (node1, node2)
                
                if best_edge:
                    rep_graph.add_edge(best_edge[0], best_edge[1], weight=min_distance)
                    edges_added += 1
                    logger.info(f"Added connecting edge: {best_edge[0]} -> {best_edge[1]} (distance: {min_distance:.2f}m)")
        
        # Update the main graph and edges set with representative connections
        self.graph = rep_graph
        self.edges = set(rep_graph.edges())
        
        return edges_added
    
    def _remove_non_representatives(self, representatives: Set[int]) -> int:
        """Remove nodes that are not representatives and update edge references."""
        # Create mapping from non-representative nodes to their representatives
        node_to_representative = {}
        for cluster in self.clusters:
            for node_id in cluster.node_ids:
                if node_id not in representatives:
                    node_to_representative[node_id] = cluster.representative_id
        
        logger.info(f"Created mapping for {len(node_to_representative)} non-representative nodes")
        
        # Update edges to point to representatives
        updated_edges = set()
        edges_mapped = 0
        edges_skipped = 0
        
        for edge in self.edges:
            node1, node2 = edge
            
            # Map nodes to their representatives if they're not representatives themselves
            new_node1 = node_to_representative.get(node1, node1)
            new_node2 = node_to_representative.get(node2, node2)
            
            # Only keep edges where both nodes are representatives
            if new_node1 in representatives and new_node2 in representatives:
                # Avoid self-loops
                if new_node1 != new_node2:
                    updated_edges.add((new_node1, new_node2))
                    edges_mapped += 1
                else:
                    edges_skipped += 1
            else:
                edges_skipped += 1
        
        logger.info(f"Mapped {edges_mapped} edges, skipped {edges_skipped} edges")
        logger.info(f"Final edge count: {len(updated_edges)}")
        
        # Debug: Show some example edge mappings
        if edges_mapped > 0:
            sample_edges = list(updated_edges)[:5]
            logger.info(f"Sample mapped edges: {sample_edges}")
        
        # Debug: Check if all representatives exist in nodes
        missing_reps = [rep for rep in representatives if rep not in self.nodes]
        if missing_reps:
            logger.warning(f"Missing representatives in nodes: {missing_reps[:10]}")
        else:
            logger.info(f"All {len(representatives)} representatives exist in nodes")
        
        # Update the edges set
        self.edges = updated_edges
        
        # Remove non-representative nodes
        nodes_to_remove = set(self.nodes.keys()) - representatives
        nodes_removed = 0
        
        for node_id in nodes_to_remove:
            if node_id in self.nodes:
                del self.nodes[node_id]
                if self.graph and self.graph.has_node(node_id):
                    self.graph.remove_node(node_id)
                nodes_removed += 1
        
        return nodes_removed
    
    def _cleanup_redundant_edges(self) -> int:
        """Remove redundant edges while maintaining connectivity."""
        if not self.graph:
            return 0
        
        edges_removed = 0
        edges_to_remove = []
        
        # Find edges that can be removed without disconnecting the graph
        for edge in self.graph.edges():
            temp_graph = self.graph.copy()
            temp_graph.remove_edge(*edge)
            
            if nx.is_connected(temp_graph):
                # Check if this edge is redundant (longer path exists)
                try:
                    path = nx.shortest_path(temp_graph, edge[0], edge[1], weight='weight')
                    if len(path) > 2:  # Path has intermediate nodes
                        edges_to_remove.append(edge)
                except nx.NetworkXNoPath:
                    # No alternative path, keep this edge
                    pass
        
        # Remove redundant edges
        for edge in edges_to_remove:
            self.graph.remove_edge(*edge)
            edges_removed += 1
        
        return edges_removed
    
    def _calculate_coverage_score(self, target_distance: float) -> float:
        """Calculate coverage score (percentage of space covered within target_distance)."""
        if not self.nodes:
            return 0.0
        
        # Create a grid of test points
        test_points = self._generate_test_points()
        
        covered_points = 0
        for point in test_points:
            if self._has_nearby_node(point, target_distance):
                covered_points += 1
        
        return covered_points / len(test_points) if test_points else 0.0
    
    def _calculate_coverage_with_representatives(self, representatives: Set[int], coverage_distance: float) -> float:
        """Calculate coverage score using only representative nodes."""
        if not representatives:
            return 0.0
        
        # Create a grid of test points
        test_points = self._generate_test_points()
        
        covered_points = 0
        scale_factor = 15.0
        
        for point in test_points:
            # Check if any representative is within coverage_distance
            for rep_id in representatives:
                if rep_id in self.nodes:
                    rep_node = self.nodes[rep_id]
                    distance = math.sqrt(
                        (point[0] - rep_node['x'] * scale_factor)**2 +
                        (point[1] - rep_node['y'] * scale_factor)**2 +
                        (point[2] - rep_node['z'] * scale_factor)**2
                    )
                    if distance <= coverage_distance:
                        covered_points += 1
                        break
        
        return covered_points / len(test_points) if test_points else 0.0
    
    def _generate_test_points(self) -> List[Tuple[float, float, float]]:
        """Generate test points for coverage calculation."""
        if not self.nodes:
            return []
        
        # Find bounding box
        x_coords = [node['x'] for node in self.nodes.values()]
        y_coords = [node['y'] for node in self.nodes.values()]
        z_coords = [node['z'] for node in self.nodes.values()]
        
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        min_z, max_z = min(z_coords), max(z_coords)
        
        # Generate grid points (simplified - could be more sophisticated)
        test_points = []
        step = 2.0  # 2m grid
        
        for x in np.arange(min_x, max_x + step, step):
            for y in np.arange(min_y, max_y + step, step):
                for z in np.arange(min_z, max_z + step, step):
                    test_points.append((x, y, z))
        
        return test_points
    
    def _has_nearby_node(self, point: Tuple[float, float, float], distance: float) -> bool:
        """Check if there's a node within the specified distance of a point."""
        for node_data in self.nodes.values():
            node_distance = math.sqrt(
                (node_data['x'] - point[0])**2 +
                (node_data['y'] - point[1])**2 +
                (node_data['z'] - point[2])**2
            )
            if node_distance <= distance:
                return True
        return False
    
    def _calculate_max_hop_distance(self) -> float:
        """Calculate the maximum hop distance in the graph."""
        if not self.graph or not self.nodes:
            return 0.0
        
        max_distance = 0.0
        
        for edge in self.graph.edges():
            distance = self._calculate_distance(edge[0], edge[1])
            max_distance = max(max_distance, distance)
        
        return max_distance
    
    def save_to_database(self, table_prefix: str = ""):
        """Save the pruned graph back to the database."""
        if not self.db_manager:
            logger.error("No database manager available")
            return
        
        logger.info("Saving pruned graph to database...")
        
        # Use original table names for test database
        nodes_table = "nodes"
        edges_table = "edges"
        
        # Begin transaction
        self.db_manager.begin_transaction()
        
        try:
            # Enable foreign key constraints
            self.db_manager.execute_write("PRAGMA foreign_keys = ON")
            
            # Get existing node IDs in the database
            existing_nodes = self.db_manager.execute_query(f"SELECT keyframe_id FROM {nodes_table}")
            existing_node_ids = {row['keyframe_id'] for row in existing_nodes}
            
            # Get existing edge pairs in the database
            existing_edges = self.db_manager.execute_query(f"SELECT keyframe_id0, keyframe_id1 FROM {edges_table}")
            existing_edge_pairs = {(row['keyframe_id0'], row['keyframe_id1']) for row in existing_edges}
            
            # Clear all existing edges and insert the new ones
            logger.info(f"Clearing all existing edges and inserting {len(self.edges)} new edges")
            self.db_manager.execute_write(f"DELETE FROM {edges_table}")
            
            # Insert the new edges from self.edges
            for edge_pair in self.edges:
                self.db_manager.execute_write(
                    f"INSERT INTO {edges_table} (keyframe_id0, keyframe_id1) VALUES (?, ?)",
                    (edge_pair[0], edge_pair[1])
                )
            
            # Remove nodes that are no longer in our pruned graph
            # With ON DELETE CASCADE, deleting from refined_nodes will automatically delete from related tables
            nodes_to_remove = existing_node_ids - set(self.nodes.keys())
            for node_id in nodes_to_remove:
                self.db_manager.execute_write(f"DELETE FROM {nodes_table} WHERE keyframe_id = ?", (node_id,))
            
            # Update remaining nodes with current data
            for node_id, node_data in self.nodes.items():
                self.db_manager.execute_write(
                    f"UPDATE {nodes_table} SET x_trans = ?, y_trans = ?, z_trans = ?, ts = ?, zone = ? WHERE keyframe_id = ?",
                    (node_data['x'], node_data['y'], node_data['z'], node_data['ts'], node_data['zone'], node_id)
                )
            
            # Commit transaction
            self.db_manager.commit_transaction()
            logger.info("Successfully saved pruned graph to database")
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            self.db_manager.rollback_transaction()
            raise
