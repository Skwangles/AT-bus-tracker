"""
Grid-based pruning strategy for spatial graphs.

This module implements a grid-based approach where nodes are partitioned into 
5x5x5 meter grid boxes, with one representative node selected per box based on
image sharpness, and all edges redirected to the selected representatives.
"""

import logging
import numpy as np
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
import math
import json
import os

from db_manager import DatabaseManager

logger = logging.getLogger(__name__)


class GridBasedPruner:
    """
    Grid-based pruning strategy that partitions nodes into regular grid boxes
    and selects the sharpest node from each box as a representative.
    """
    
    def __init__(self, db_manager: DatabaseManager, coords_to_metres: float = 15.0, sharpness_data: Optional[Dict[str, float]] = None):
        """
        Initialize the grid-based pruner.
        
        Args:
            db_manager: Database manager instance
            coords_to_metres: Scale factor to convert coordinates to metres and for final transformation (default: 15.0)
            sharpness_data: Dictionary mapping image filenames to sharpness values
        """

        if coords_to_metres is None or coords_to_metres <= 0.0:
            raise ValueError("coords_to_metres must be a positive number")

        self.db_manager = db_manager
        self.coords_to_metres = coords_to_metres if coords_to_metres is not None and coords_to_metres > 0.0 else 15.0
        self.nodes = {}  # node_id -> {'x': float, 'y': float, 'z': float, 'zone': str, 'is_referenced': bool, 'sharpness': float}
        self.edges = set()  # set of (node1_id, node2_id) tuples
        self.grid_boxes = {}  # grid_key -> list of node_ids
        self.representatives = {}  # grid_key -> list of representative_node_ids (can be multiple for referenced nodes)
        self.node_to_representative = {}  # node_id -> list of representative_node_ids
        self.referenced_nodes = set()  # set of node IDs that are referenced by other_nodes
        self.sharpness_data = sharpness_data or {}
        
    def load_sharpness_data(self, sharpness_json_path: str) -> bool:
        """
        Load sharpness data from a JSON file.
        
        Args:
            sharpness_json_path: Path to the sharpness JSON file
            
        Returns:
            bool: True if data loaded successfully, False otherwise
        """
        try:
            if os.path.exists(sharpness_json_path):
                with open(sharpness_json_path, 'r') as f:
                    self.sharpness_data = json.load(f)
                logger.info(f"Loaded sharpness data for {len(self.sharpness_data)} images from {sharpness_json_path}")
                return True
            else:
                logger.warning(f"Sharpness file not found: {sharpness_json_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to load sharpness data: {e}")
            return False
    
    def load_graph_data(self) -> bool:
        """
        Load nodes and edges from the database.
        
        Returns:
            bool: True if data loaded successfully, False otherwise
        """
        try:
            # Use standard table names
            nodes_table = "nodes"
            edges_table = "edges"
            
            # Load nodes
            logger.info(f"Loading nodes from {nodes_table}...")
            query = f"SELECT keyframe_id, ts, x_trans, y_trans, z_trans, zone FROM {nodes_table}"
            rows = self.db_manager.execute_query(query)
            
            for row in rows:
                node_id = row['keyframe_id']
                x, y, z = row['x_trans'], row['y_trans'], row['z_trans']
                ts = round(row['ts'], 5)
                zone = row['zone']

                # Apply coordinate scaling
                scaled_x = float(x) * self.coords_to_metres
                scaled_y = float(y) * self.coords_to_metres
                scaled_z = float(z) * self.coords_to_metres

                # Construct image filename from keyframe_id and look up sharpness
                image_filename = f"{ts:.5f}.png"
                sharpness_value = self.sharpness_data.get(image_filename, 0.0)
                
                self.nodes[node_id] = {
                    'x': scaled_x,
                    'y': scaled_y, 
                    'z': scaled_z,
                    'zone': zone or 'unknown',
                    'is_referenced': False,  # Will be updated after loading references
                    'ts': ts,  # Store timestamp for sharpness lookup
                    'sharpness': sharpness_value
                }
            
            logger.info(f"Loaded {len(self.nodes)} nodes")
            
            # Load referenced nodes (nodes that are referenced by other_nodes)
            logger.info("Loading referenced nodes...")
            try:
                refs_query = "SELECT DISTINCT ref_id FROM other_nodes"
                ref_rows = self.db_manager.execute_query(refs_query)
                
                for row in ref_rows:
                    node_id = row['ref_id']
                    if node_id in self.nodes:
                        self.nodes[node_id]['is_referenced'] = True
                        self.referenced_nodes.add(node_id)
                
                logger.info(f"Loaded {len(self.referenced_nodes)} referenced nodes")
            except Exception as e:
                logger.warning(f"Could not load referenced nodes: {e}")
                logger.warning("Proceeding without reference preservation")
            
            # Load sharpness data if not already loaded
            if not self.sharpness_data:
                sharpness_json_path = "sharpness.json"
                self.load_sharpness_data(sharpness_json_path)
            
            # Update sharpness values for all nodes
            for node_id, node_data in self.nodes.items():
                ts = node_data.get('ts', 0.0)  # Get timestamp from node data
                image_filename = f"{ts:.5f}.png"
                sharpness_value = self.sharpness_data.get(image_filename, 0.0)
                node_data['sharpness'] = sharpness_value
            
            # Log sharpness statistics
            if self.sharpness_data:
                sharpness_values = [node_data['sharpness'] for node_data in self.nodes.values()]
                if sharpness_values:
                    logger.info(f"Sharpness statistics: min={min(sharpness_values):.2f}, max={max(sharpness_values):.2f}, mean={np.mean(sharpness_values):.2f}")
                    nodes_with_sharpness = sum(1 for s in sharpness_values if s > 0.0)
                    logger.info(f"Nodes with sharpness data: {nodes_with_sharpness}/{len(sharpness_values)}")
            else:
                logger.warning("No sharpness data available - all nodes will have sharpness 0.0")

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
    
    def _get_grid_key(self, x: float, y: float, z: float, grid_size: float = 5.0, grid_size_y: float = 2.0) -> Tuple[int, int, int]:
        """
        Calculate the grid box key for given coordinates.
        
        Args:
            x, y, z: Coordinates in metres
            grid_size: Size of each grid box in metres (default: 5.0)
            NOTE: The grid_size is halved in the Y direction e.g. 10x5x10 grid box.
        Returns:
            Tuple[int, int, int]: Grid box coordinates (grid_x, grid_y, grid_z)
        """
        grid_x = int(math.floor(x / grid_size))
        grid_y = int(math.floor(y / grid_size_y))
        grid_z = int(math.floor(z / grid_size))
        return (grid_x, grid_y, grid_z)
    
    def _partition_into_grid(self, grid_size: float = 5.0, grid_size_y: float = 2.0) -> Dict[Tuple[int, int, int], List[int]]:
        """
        Partition all nodes into grid boxes.
        
        Args:
            grid_size: Size of each grid box in metres (default: 5.0)
            grid_size_y: Size of each grid box in the Y direction (default: 2.0)
        Returns:
            Dict mapping grid keys to lists of node IDs
        """
        logger.info(f"Partitioning {len(self.nodes)} nodes into {grid_size}x{grid_size_y}x{grid_size}m grid boxes...")
        
        grid_boxes = defaultdict(list)
        
        for node_id, node_data in self.nodes.items():
            x, y, z = node_data['x'], node_data['y'], node_data['z']
            grid_key = self._get_grid_key(x, y, z, grid_size, grid_size_y)
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
    
    def _select_representatives(self) -> Dict[Tuple[int, int, int], List[int]]:
        """
        Select representative nodes for each grid box.
        
        This method selects only the sharpest node from each grid box as the representative,
        regardless of whether nodes are referenced or not. All references will be redirected
        to the chosen representative.
        
        Returns:
            Dict mapping grid keys to lists of representative node IDs
        """
        logger.info("Selecting representative nodes for each grid box...")
        logger.info("Using sharpness-based selection for all nodes (including referenced ones)")
        
        representatives = {}
        total_representatives = 0
        sharpness_selections = 0
        referenced_nodes_removed = 0
        
        for grid_key, node_ids in self.grid_boxes.items():
            if not node_ids:
                continue
                
            # Select the sharpest node from all nodes in this grid box
            if len(node_ids) == 1:
                # Only one node, keep it
                chosen_representative = node_ids[0]
            else:
                # Multiple nodes, select the sharpest one
                chosen_representative = self._select_sharpest_node(node_ids)
                sharpness_value = self.nodes[chosen_representative]['sharpness']
                logger.debug(f"Selected sharpest node {chosen_representative} with sharpness {sharpness_value:.2f} from {len(node_ids)} nodes in grid box {grid_key}")
                sharpness_selections += 1
            
            representatives[grid_key] = [chosen_representative]
            
            # Count how many referenced nodes are being removed
            referenced_in_box = [node_id for node_id in node_ids if self.nodes[node_id]['is_referenced']]
            if chosen_representative not in referenced_in_box:
                referenced_nodes_removed += len(referenced_in_box)
            
            # Map all nodes in this box to the single representative
            for node_id in node_ids:
                self.node_to_representative[node_id] = [chosen_representative]
            
            total_representatives += 1
        
        self.representatives = representatives
        
        total_nodes = len(self.nodes)
        reduction_percentage = ((total_nodes - total_representatives) / total_nodes) * 100
        
        logger.info(f"Selected {total_representatives} representative nodes from {total_nodes} total nodes")
        logger.info(f"Node reduction: {reduction_percentage:.1f}%")
        logger.info(f"Referenced nodes being removed: {referenced_nodes_removed} (references will be redirected)")
        logger.info(f"Sharpness-based selections: {sharpness_selections}")
        
        return representatives
    
    def _select_sharpest_node(self, node_ids: List[int]) -> int:
        """
        Select the node with the highest sharpness value from a list of nodes.
        Falls back to centrality-based selection if no sharpness data is available.
        
        Args:
            node_ids: List of node IDs to choose from
            
        Returns:
            int: ID of the sharpest node (or most central if no sharpness data)
        """
        if not node_ids:
            return None # Should not happen if called with non-empty list
        
        # Check if we have any sharpness data
        has_sharpness_data = any(self.nodes[node_id]['sharpness'] > 0.0 for node_id in node_ids)
        
        if not has_sharpness_data:
            logger.debug("No sharpness data available, falling back to first node selection")
            return node_ids[0]
        
        # Select based on sharpness
        sharpest_node = node_ids[0]
        max_sharpness = self.nodes[sharpest_node]['sharpness']
        
        for node_id in node_ids:
            current_sharpness = self.nodes[node_id]['sharpness']
            if current_sharpness > max_sharpness:
                max_sharpness = current_sharpness
                sharpest_node = node_id
        
        return sharpest_node
    
    def _redirect_references(self) -> int:
        """
        Redirect all references in the other_nodes table from removed nodes to their representatives.
        
        Returns:
            int: Number of references redirected
        """
        logger.info("Redirecting references in other_nodes table...")
        
        try:
            # Get all reference redirections needed
            reference_redirections = []
            
            for node_id, representatives in self.node_to_representative.items():
                if node_id not in representatives:  # This node is being removed
                    representative = representatives[0]  # Get the single representative
                    reference_redirections.append((representative, node_id))
            
            if not reference_redirections:
                logger.info("No references need to be redirected")
                return 0
            
            # Update references in other_nodes table
            redirected_count = 0
            for representative, old_node_id in reference_redirections:
                update_query = "UPDATE other_nodes SET ref_id = ? WHERE ref_id = ?"
                affected_rows = self.db_manager.execute_write(update_query, (representative, old_node_id))
                redirected_count += affected_rows
                
                if affected_rows > 0:
                    logger.debug(f"Redirected {affected_rows} references from node {old_node_id} to {representative}")
            
            logger.info(f"Redirected {redirected_count} references in other_nodes table")
            return redirected_count
            
        except Exception as e:
            logger.error(f"Error redirecting references: {e}")
            return 0
    
    def _redirect_edges(self) -> Set[Tuple[int, int]]:
        """
        Redirect all edges to connect representative nodes only.
        
        All nodes (both referenced and unreferenced) are now mapped to
        their single representative node, so edges are redirected accordingly.
        
        Returns:
            Set of new edges between representative nodes
        """
        logger.info("Redirecting edges to representative nodes...")
        
        new_edges = set()
        edge_redirections = 0
        
        for node1_id, node2_id in self.edges:
            # Get representatives for both nodes
            reps1 = self.node_to_representative.get(node1_id, [node1_id])
            reps2 = self.node_to_representative.get(node2_id, [node2_id])
            
            # Create edges between all representative combinations
            for rep1 in reps1:
                for rep2 in reps2:
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
        representative_nodes = set()
        for grid_reps in self.representatives.values():
            representative_nodes.update(grid_reps)
        
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
    
    def grid_based_pruning(self, grid_size: float = 5.0, grid_size_y: float = 2.0) -> Dict:
        """
        Perform grid-based pruning of the graph.
        
        Args:
            grid_size: Size of each grid box in metres (default: 5.0)
            
        Returns:
            Dict with pruning statistics and results
        """
        logger.info(f"Starting grid-based pruning with {grid_size}x{grid_size_y}x{grid_size}m grid boxes...")
        
        original_nodes = len(self.nodes)
        original_edges = len(self.edges)
        
        # Step 1: Partition nodes into grid boxes
        self._partition_into_grid(grid_size, grid_size_y)
        
        # Step 2: Select representative nodes for each box
        self._select_representatives()
        
        # Step 3: Redirect references to representatives
        self._redirect_references()
        
        # Step 4: Redirect edges to representatives
        self._redirect_edges()
        
        # Step 5: Validate connectivity
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
            'grid_size_y_metres': grid_size_y,
            'connectivity_maintained': connectivity_maintained,
            'coords_to_metres_scale': self.coords_to_metres
        }
        
        logger.info("=== GRID PRUNING RESULTS ===")
        logger.info(f"Nodes: {original_nodes} → {final_nodes} ({node_reduction:.1f}% reduction)")
        logger.info(f"Edges: {original_edges} → {final_edges} ({edge_reduction:.1f}% reduction)")
        logger.info(f"Grid boxes: {len(self.grid_boxes)} ({grid_size}x{grid_size_y}x{grid_size}m)")
        logger.info(f"Connectivity: {'✅ Maintained' if connectivity_maintained else '❌ Lost'}")
        logger.info(f"Coordinate scaling: {self.coords_to_metres}x")
        
        return results
    
    async def _cleanup_orphaned_edges(self) -> int:
        """
        Clean up any edges that reference non-existent nodes.
        
        Returns:
            int: Number of orphaned edges removed
        """
        try:
            # Use standard table names
            edges_table = "edges"
            nodes_table = "nodes"
            
            # Find and delete orphaned edges
            cleanup_query = f"""
                DELETE FROM {edges_table} 
                WHERE keyframe_id0 NOT IN (SELECT keyframe_id FROM {nodes_table})
                   OR keyframe_id1 NOT IN (SELECT keyframe_id FROM {nodes_table})
            """
            
            # Execute the cleanup
            orphaned_count = self.db_manager.execute_write(cleanup_query)
            
            if orphaned_count > 0:
                logger.info(f"Removed {orphaned_count} orphaned edges from {edges_table}")
            else:
                logger.info(f"No orphaned edges found in {edges_table}")
            
            return orphaned_count
            
        except Exception as e:
            logger.error(f"Error cleaning up orphaned edges: {e}")
            return 0
    
    def _apply_final_coordinate_transformation(self) -> None:
        """
        Apply the final coordinate transformation to representative nodes.
        The SLAM output produces coordinates in the camera coordinate system and need to be transformed to the world coordinate system.
        (-x, -y, z) -> (x, y, z)
        Because SLAM output is scale invariant, we need to apply our own SCALE FACTOR to the coordinates.
        """
        logger.info("Applying final coordinate transformation...")
        
        # Get all representative node IDs (flatten the lists)
        representative_node_ids = set()
        for grid_reps in self.representatives.values():
            representative_node_ids.update(grid_reps)
        
        transformation_count = 0
        
        for node_id in representative_node_ids:
            if node_id in self.nodes:
                node_data = self.nodes[node_id]
                
                # Apply transformation: -1 * coordinate, then multiply by coords_to_metres
                original_x = node_data['x']
                original_y = node_data['y']
                original_z = node_data['z']
                
                # Transform - negate x and y to make upright
                transformed_x = -original_x
                transformed_y = -original_y
                transformed_z = original_z # already correctly aligned, don't need to negate
                
                # Update the node data
                node_data['x'] = transformed_x
                node_data['y'] = transformed_y
                node_data['z'] = transformed_z
                
                transformation_count += 1
                
                logger.debug(f"Transformed node {node_id}: ({original_x:.3f}, {original_y:.3f}, {original_z:.3f}) -> ({transformed_x:.3f}, {transformed_y:.3f}, {transformed_z:.3f})")
        
        logger.info(f"Applied final coordinate transformation to {transformation_count} representative nodes")
        logger.info(f"Transformation: x_trans = -{self.coords_to_metres} * original_x, y_trans = -{self.coords_to_metres} * original_y")

    async def save_to_database(self) -> bool:
        """
        Save the pruned graph to database.
        
        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            # Use standard table names
            nodes_table = "nodes"
            edges_table = "edges"
            
            logger.info(f"Saving pruned graph to {nodes_table} and {edges_table}...")
            
            # Enable foreign keys for cascading deletes
            self.db_manager.execute_write("PRAGMA foreign_keys = ON")
            
            # Start transaction
            self.db_manager.begin_transaction()
            
            # Step 1: Redirect references before deleting nodes
            logger.info("Redirecting references to representative nodes...")
            redirected_references = self._redirect_references()
            
            # Step 2: Apply final coordinate transformation
            self._apply_final_coordinate_transformation()
            self.db_manager.flip_other_nodes_xy(scale_factor=self.coords_to_metres)
            
            # Get all representative node IDs (flatten the lists)
            representative_node_ids = set()
            for grid_reps in self.representatives.values():
                representative_node_ids.update(grid_reps)
            
            # Step 3: Update coordinates for representative nodes in database
            logger.info("Updating coordinates for representative nodes...")
            for node_id in representative_node_ids:
                if node_id in self.nodes:
                    node_data = self.nodes[node_id]
                    # Convert back to original coordinate system for database storage
                    # Since we applied -15 * original, we need to store the transformed values
                    self.db_manager.update_node_position(
                        node_id, 
                        node_data['x'], 
                        node_data['y'], 
                        node_data['z']
                    )
            
            # Step 4: Delete non-representative nodes (edges will cascade)
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
            
            # Step 5: Delete all existing edges and insert new ones
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
            
            # Step 6: Clean up orphaned edges (edges that reference non-existent nodes)
            logger.info("Cleaning up orphaned edges...")
            orphaned_edges_removed = await self._cleanup_orphaned_edges()
            
            logger.info("✅ Successfully saved pruned graph to database")
            if redirected_references > 0:
                logger.info(f"🔄 Redirected {redirected_references} references to representative nodes")
            if orphaned_edges_removed > 0:
                logger.info(f"🧹 Cleaned up {orphaned_edges_removed} orphaned edges")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
            self.db_manager.rollback_transaction()
            return False
