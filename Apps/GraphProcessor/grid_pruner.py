"""
Grid-based pruning strategy for spatial graphs.

This module implements a grid-based approach where nodes are partitioned into 
5x5x5 meter grid boxes, with one representative node selected per box based on
centrality, and all edges redirected to the selected representatives.
"""

import logging
import numpy as np
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
import math

from db_manager import DatabaseManager
from spatial_utils import calculate_3d_distance

logger = logging.getLogger(__name__)


class GridBasedPruner:
    """
    Grid-based pruning strategy that partitions nodes into regular grid boxes
    and selects the most central node from each box as a representative.
    """
    
    def __init__(self, db_manager: DatabaseManager, coords_to_metres: float = 15.0):
        """
        Initialize the grid-based pruner.
        
        Args:
            db_manager: Database manager instance
            coords_to_metres: Scale factor to convert coordinates to metres (default: 15.0)
        """
        self.db_manager = db_manager
        self.coords_to_metres = coords_to_metres
        self.nodes = {}  # node_id -> {'x': float, 'y': float, 'z': float, 'zone': str}
        self.edges = set()  # set of (node1_id, node2_id) tuples
        self.grid_boxes = {}  # grid_key -> list of node_ids
        self.representatives = {}  # grid_key -> selected_node_id
        self.node_to_representative = {}  # node_id -> representative_node_id
        
    def load_graph_data(self, table_name_prefix: str = "") -> bool:
        """
        Load nodes and edges from the database.
        
        Args:
            table_name_prefix: Prefix for table names (e.g., "refined_")
            
        Returns:
            bool: True if data loaded successfully, False otherwise
        """
        try:
            # Determine table names
            nodes_table = f"{table_name_prefix}nodes" if table_name_prefix else "nodes"
            edges_table = f"{table_name_prefix}edges" if table_name_prefix else "edges"
            
            # Load nodes
            logger.info(f"Loading nodes from {nodes_table}...")
            query = f"SELECT keyframe_id, x_trans, y_trans, z_trans, zone FROM {nodes_table}"
            rows = self.db_manager.execute_query(query)
            
            for row in rows:
                node_id = row['keyframe_id']
                x, y, z = row['x_trans'], row['y_trans'], row['z_trans']
                zone = row['zone']
                # Apply coordinate scaling
                scaled_x = float(x) * self.coords_to_metres
                scaled_y = float(y) * self.coords_to_metres
                scaled_z = float(z) * self.coords_to_metres
                
                self.nodes[node_id] = {
                    'x': scaled_x,
                    'y': scaled_y, 
                    'z': scaled_z,
                    'zone': zone or 'unknown'
                }
            
            logger.info(f"Loaded {len(self.nodes)} nodes")
            
            # Load edges
            logger.info(f"Loading edges from {edges_table}...")
            query = f"SELECT keyframe_id0, keyframe_id1 FROM {edges_table}"
            rows = self.db_manager.execute_query(query)
            
            for row in rows:
                node1_id, node2_id = row['keyframe_id0'], row['keyframe_id1']
                # Only include edges where both nodes exist
                if node1_id in self.nodes and node2_id in self.nodes:
                    self.edges.add((min(node1_id, node2_id), max(node1_id, node2_id)))
            
            logger.info(f"Loaded {len(self.edges)} edges")
            
            return len(self.nodes) > 0
            
        except Exception as e:
            logger.error(f"Error loading graph data: {e}")
            return False
    
    def _get_grid_key(self, x: float, y: float, z: float, grid_size: float = 5.0) -> Tuple[int, int, int]:
        """
        Calculate the grid box key for given coordinates.
        
        Args:
            x, y, z: Coordinates in metres
            grid_size: Size of each grid box in metres (default: 5.0)
            
        Returns:
            Tuple[int, int, int]: Grid box coordinates (grid_x, grid_y, grid_z)
        """
        grid_x = int(math.floor(x / grid_size))
        grid_y = int(math.floor(y / grid_size))
        grid_z = int(math.floor(z / grid_size))
        return (grid_x, grid_y, grid_z)
    
    def _partition_into_grid(self, grid_size: float = 5.0) -> Dict[Tuple[int, int, int], List[int]]:
        """
        Partition all nodes into grid boxes.
        
        Args:
            grid_size: Size of each grid box in metres (default: 5.0)
            
        Returns:
            Dict mapping grid keys to lists of node IDs
        """
        logger.info(f"Partitioning {len(self.nodes)} nodes into {grid_size}x{grid_size}x{grid_size}m grid boxes...")
        
        grid_boxes = defaultdict(list)
        
        for node_id, node_data in self.nodes.items():
            x, y, z = node_data['x'], node_data['y'], node_data['z']
            grid_key = self._get_grid_key(x, y, z, grid_size)
            grid_boxes[grid_key].append(node_id)
        
        # Convert to regular dict
        self.grid_boxes = dict(grid_boxes)
        
        # Log statistics
        non_empty_boxes = len(self.grid_boxes)
        nodes_per_box = [len(nodes) for nodes in self.grid_boxes.values()]
        avg_nodes_per_box = np.mean(nodes_per_box) if nodes_per_box else 0
        max_nodes_per_box = max(nodes_per_box) if nodes_per_box else 0
        
        logger.info(f"Created {non_empty_boxes} non-empty grid boxes")
        logger.info(f"Average nodes per box: {avg_nodes_per_box:.2f}")
        logger.info(f"Maximum nodes per box: {max_nodes_per_box}")
        
        return self.grid_boxes
    
    def _select_central_node(self, node_ids: List[int]) -> int:
        """
        Select the most central node from a list of nodes.
        
        The central node is chosen as the one with minimum sum of distances
        to all other nodes in the same grid box.
        
        Args:
            node_ids: List of node IDs in the same grid box
            
        Returns:
            int: ID of the most central node
        """
        if len(node_ids) == 1:
            return node_ids[0]
        
        # Calculate centroid of all nodes in the box
        positions = []
        for node_id in node_ids:
            node_data = self.nodes[node_id]
            positions.append([node_data['x'], node_data['y'], node_data['z']])
        
        positions = np.array(positions)
        centroid = np.mean(positions, axis=0)
        
        # Find node closest to centroid
        min_distance = float('inf')
        central_node = node_ids[0]
        
        for i, node_id in enumerate(node_ids):
            distance = np.linalg.norm(positions[i] - centroid)
            if distance < min_distance:
                min_distance = distance
                central_node = node_id
        
        return central_node
    
    def _select_representatives(self) -> Dict[Tuple[int, int, int], int]:
        """
        Select representative nodes for each grid box.
        
        Returns:
            Dict mapping grid keys to selected representative node IDs
        """
        logger.info("Selecting representative nodes for each grid box...")
        
        representatives = {}
        
        for grid_key, node_ids in self.grid_boxes.items():
            representative = self._select_central_node(node_ids)
            representatives[grid_key] = representative
            
            # Map all nodes in this box to the representative
            for node_id in node_ids:
                self.node_to_representative[node_id] = representative
        
        self.representatives = representatives
        
        selected_nodes = len(representatives)
        total_nodes = len(self.nodes)
        reduction_percentage = ((total_nodes - selected_nodes) / total_nodes) * 100
        
        logger.info(f"Selected {selected_nodes} representative nodes from {total_nodes} total nodes")
        logger.info(f"Node reduction: {reduction_percentage:.1f}%")
        
        return representatives
    
    def _redirect_edges(self) -> Set[Tuple[int, int]]:
        """
        Redirect all edges to connect representative nodes only.
        
        Returns:
            Set of new edges between representative nodes
        """
        logger.info("Redirecting edges to representative nodes...")
        
        new_edges = set()
        edge_redirections = 0
        
        for node1_id, node2_id in self.edges:
            rep1 = self.node_to_representative.get(node1_id, node1_id)
            rep2 = self.node_to_representative.get(node2_id, node2_id)
            
            # Only add edge if representatives are different (avoid self-loops)
            if rep1 != rep2:
                new_edge = (min(rep1, rep2), max(rep1, rep2))
                new_edges.add(new_edge)
                
                if rep1 != node1_id or rep2 != node2_id:
                    edge_redirections += 1
        
        logger.info(f"Original edges: {len(self.edges)}")
        logger.info(f"New edges: {len(new_edges)}")
        logger.info(f"Edge redirections: {edge_redirections}")
        
        self.edges = new_edges
        return new_edges
    
    def _validate_connectivity(self) -> bool:
        """
        Validate that the pruned graph maintains connectivity.
        
        Returns:
            bool: True if graph is connected, False otherwise
        """
        if not self.representatives:
            return False
        
        # Build adjacency list for representative nodes
        representative_nodes = set(self.representatives.values())
        adjacency = defaultdict(set)
        
        for node1, node2 in self.edges:
            if node1 in representative_nodes and node2 in representative_nodes:
                adjacency[node1].add(node2)
                adjacency[node2].add(node1)
        
        # Perform DFS to check connectivity
        if not representative_nodes:
            return True
        
        start_node = next(iter(representative_nodes))
        visited = set()
        stack = [start_node]
        
        while stack:
            node = stack.pop()
            if node not in visited:
                visited.add(node)
                stack.extend(adjacency[node] - visited)
        
        is_connected = len(visited) == len(representative_nodes)
        
        if is_connected:
            logger.info("✅ Graph connectivity maintained")
        else:
            logger.warning(f"❌ Graph disconnected: {len(visited)}/{len(representative_nodes)} nodes reachable")
        
        return is_connected
    
    def grid_based_pruning(self, grid_size: float = 5.0) -> Dict:
        """
        Perform grid-based pruning of the graph.
        
        Args:
            grid_size: Size of each grid box in metres (default: 5.0)
            
        Returns:
            Dict with pruning statistics and results
        """
        logger.info(f"Starting grid-based pruning with {grid_size}x{grid_size}x{grid_size}m grid boxes...")
        
        original_nodes = len(self.nodes)
        original_edges = len(self.edges)
        
        # Step 1: Partition nodes into grid boxes
        self._partition_into_grid(grid_size)
        
        # Step 2: Select representative nodes for each box
        self._select_representatives()
        
        # Step 3: Redirect edges to representatives
        self._redirect_edges()
        
        # Step 4: Validate connectivity
        connectivity_maintained = self._validate_connectivity()
        
        # Calculate final statistics
        final_nodes = len(self.representatives)
        final_edges = len(self.edges)
        
        node_reduction = ((original_nodes - final_nodes) / original_nodes) * 100
        edge_reduction = ((original_edges - final_edges) / original_edges) * 100
        
        results = {
            'original_nodes': original_nodes,
            'final_nodes': final_nodes,
            'original_edges': original_edges,
            'final_edges': final_edges,
            'node_reduction_percent': node_reduction,
            'edge_reduction_percent': edge_reduction,
            'grid_boxes_created': len(self.grid_boxes),
            'grid_size_metres': grid_size,
            'connectivity_maintained': connectivity_maintained,
            'coords_to_metres_scale': self.coords_to_metres
        }
        
        logger.info("=== GRID PRUNING RESULTS ===")
        logger.info(f"Nodes: {original_nodes} → {final_nodes} ({node_reduction:.1f}% reduction)")
        logger.info(f"Edges: {original_edges} → {final_edges} ({edge_reduction:.1f}% reduction)")
        logger.info(f"Grid boxes: {len(self.grid_boxes)} ({grid_size}x{grid_size}x{grid_size}m)")
        logger.info(f"Connectivity: {'✅ Maintained' if connectivity_maintained else '❌ Lost'}")
        logger.info(f"Coordinate scaling: {self.coords_to_metres}x")
        
        return results
    
    def save_to_database(self, table_name_prefix: str = "") -> bool:
        """
        Save the pruned graph to database.
        
        Args:
            table_name_prefix: Prefix for table names (e.g., "refined_")
            
        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            # Determine table names
            nodes_table = f"{table_name_prefix}nodes" if table_name_prefix else "nodes"
            edges_table = f"{table_name_prefix}edges" if table_name_prefix else "edges"
            
            logger.info(f"Saving pruned graph to {nodes_table} and {edges_table}...")
            
            # Enable foreign keys for cascading deletes
            self.db_manager.execute_write("PRAGMA foreign_keys = ON")
            
            # Start transaction
            self.db_manager.begin_transaction()
            
            # Get representative node IDs
            representative_node_ids = set(self.representatives.values())
            
            # Delete non-representative nodes (edges will cascade)
            node_ids_to_delete = []
            for node_id in self.nodes.keys():
                if node_id not in representative_node_ids:
                    node_ids_to_delete.append(node_id)
            
            if node_ids_to_delete:
                # Delete in batches to avoid SQL parameter limits
                batch_size = 500
                for i in range(0, len(node_ids_to_delete), batch_size):
                    batch = node_ids_to_delete[i:i + batch_size]
                    placeholders = ','.join(['?' for _ in batch])
                    delete_query = f"DELETE FROM {nodes_table} WHERE keyframe_id IN ({placeholders})"
                    self.db_manager.execute_write(delete_query, batch)
                
                logger.info(f"Deleted {len(node_ids_to_delete)} non-representative nodes")
            
            # Delete all existing edges and insert new ones
            self.db_manager.execute_write(f"DELETE FROM {edges_table}")
            
            # Insert new edges
            if self.edges:
                edge_data = [(node1, node2) for node1, node2 in self.edges]
                batch_size = 500
                
                for i in range(0, len(edge_data), batch_size):
                    batch = edge_data[i:i + batch_size]
                    insert_query = f"INSERT INTO {edges_table} (keyframe_id0, keyframe_id1) VALUES (?, ?)"
                    self.db_manager.execute_many(insert_query, batch)
                
                logger.info(f"Inserted {len(self.edges)} new edges")
            
            # Commit transaction
            self.db_manager.commit_transaction()
            
            logger.info("✅ Successfully saved pruned graph to database")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            self.db_manager.rollback_transaction()
            return False
