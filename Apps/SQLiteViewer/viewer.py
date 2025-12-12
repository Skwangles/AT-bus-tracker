#!/usr/bin/env python3
"""
SQLiteViewer - 3D Visualisation Tool for Spatial Graph Data

A comprehensive 3D visualisation tool for exploring and manipulating spatial graph data
stored in SQLite databases. Provides interactive 3D interface for viewing nodes, edges,
and other spatial elements with capabilities for data inspection, editing, and analysis.

Author: Sitexplorer Team
Version: 2.0
"""

import sqlite3
import numpy as np
import pyvista as pv
from tqdm import tqdm
import math
import sys
import argparse
from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass
from enum import IntEnum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration Constants
DEFAULT_PROXIMITY = 1.5 / 10
DEFAULT_SHOW_EDGES = True

class EdgeType(IntEnum):
    """Edge type classifications"""
    COVISIBILITY = -1
    NORMAL = 0
    TYPE_1 = 1
    TYPE_2 = 2
    EDGE_CONTRACTION = 3

class NodeType(IntEnum):
    """Other node type classifications"""
    NORMAL = 0
    ELEVATOR = 1
    TOILET_INFO = 2
    ROOM = 3

@dataclass
class Node:
    """Represents a spatial graph node"""
    keyframe_id: int
    position: Tuple[float, float, float]
    pose: np.ndarray
    zone: Optional[str] = None
    
    def __str__(self) -> str:
        return f"Node {self.keyframe_id} at {self.position} with pose {self.pose.shape}"
    
    def get_arrow(self) -> pv.Cone:
        """Generate 3D arrow representation showing orientation"""
        rot_mat = self.pose[:3, :3]
        yaw = np.arctan2(rot_mat[0, 0], rot_mat[0, 2])
        direction_vector = np.array([np.cos(yaw), 0, np.sin(yaw)])
        return pv.Cone(
            center=tuple(self.position), 
            direction=direction_vector.tolist(), 
            height=0.1, 
            radius=0.1, 
            resolution=50
        )

@dataclass
class OtherNode:
    """Represents additional spatial points of interest"""
    id: int
    ref_id: int
    label: str
    description: str
    info: str
    image: str
    node_type: int
    position: Tuple[float, float, float]
    
    def get_sphere(self) -> pv.Sphere:
        """Generate 3D sphere representation"""
        return pv.Sphere(center=self.position, radius=0.05)

@dataclass
class Edge:
    """Represents a connection between nodes"""
    keyframe_id0: int
    keyframe_id1: int
    edge_type: int = EdgeType.NORMAL
    zone: Optional[str] = None

class SQLiteViewer:
    """Main SQLiteViewer class for 3D spatial graph visualisation"""
    
    def __init__(self, db_path: str, proximity: float = DEFAULT_PROXIMITY, show_edges: bool = DEFAULT_SHOW_EDGES):
        """
        Initialize the SQLiteViewer
        
        Args:
            db_path: Path to the SQLite database
            proximity: Neighbour detection radius
            show_edges: Whether to render edges
        """
        self.db_path = db_path
        self.proximity = proximity
        self.show_edges = show_edges
        
        # Data storage
        self.nodes: List[Node] = []
        self.other_nodes: List[OtherNode] = []
        self.edges: List[Edge] = []
        self.elevator_shafts: Dict[str, List[int]] = {}
        
        # Visualisation state
        self.plotter: Optional[pv.Plotter] = None
        self.node_mapping: Dict[int, int] = {}  # keyframe_id -> index
        self.idx_to_id: Dict[int, int] = {}     # index -> keyframe_id
        self.pos_map: Dict[str, int] = {}       # position string -> index
        self.edge_actors: List[Any] = []
        self.temp_viewed_mesh: List[Any] = []
        
        # Interaction state
        self.picked_id: int = -1
        self.second_id: int = -1
        self.removeable_ids: List[int] = []
        self.addable_edges: List[Tuple[int, int]] = []
        self.removeable_edges: List[Tuple[int, int]] = []
        
        # Edge type colours
        self.edge_type_colors = {
            EdgeType.NORMAL: "blue",
            EdgeType.TYPE_1: "green", 
            EdgeType.TYPE_2: "orange",
            EdgeType.EDGE_CONTRACTION: "red",
            EdgeType.COVISIBILITY: "purple"
        }
        
        # Node type colours
        self.node_type_colors = {
            NodeType.NORMAL: "gray",
            NodeType.ELEVATOR: "red",
            NodeType.TOILET_INFO: "orange", 
            NodeType.ROOM: "purple"
        }
    
    def load_nodes(self) -> List[Node]:
        """Load nodes from the SQLite database"""
        logger.info("Loading nodes from database...")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Check if zone column exists
            cursor.execute("PRAGMA table_info(nodes)")
            columns = [column[1] for column in cursor.fetchall()]
            has_zone = 'zone' in columns
            
            if has_zone:
                query = "SELECT keyframe_id, x_trans, y_trans, z_trans, pose, zone FROM nodes"
            else:
                query = "SELECT keyframe_id, x_trans, y_trans, z_trans, pose FROM nodes"
            
            logger.info(f"Executing: {query}")
            cursor.execute(query)
            rows = cursor.fetchall()
            
            nodes = []
            for row in tqdm(rows, desc="Loading nodes"):
                keyframe_id = int(row[0])
                position = (float(row[1]), float(row[2]), float(row[3]))
                pose = np.frombuffer(row[4], dtype=np.double).reshape(4, 4)
                zone = row[5] if has_zone and len(row) > 5 else None
                
                node = Node(keyframe_id, position, pose, zone)
                nodes.append(node)
            
            connection.close()
            logger.info(f"Loaded {len(nodes)} nodes")
            return nodes
            
        except sqlite3.Error as e:
            logger.error(f"Database error loading nodes: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading nodes: {e}")
            return []
    
    def load_other_nodes(self) -> List[OtherNode]:
        """Load other_nodes from the SQLite database"""
        logger.info("Loading other_nodes from database...")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Check if other_nodes table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='other_nodes'")
            if not cursor.fetchone():
                logger.info("other_nodes table not found, skipping...")
                connection.close()
                return []
            
            query = "SELECT id, ref_id, label, description, info, image, type, x_trans, y_trans, z_trans FROM other_nodes"
            logger.info(f"Executing: {query}")
            cursor.execute(query)
            rows = cursor.fetchall()
            
            other_nodes = []
            for row in tqdm(rows, desc="Loading other_nodes"):
                node_id, ref_id, label, description, info, image, node_type, x_trans, y_trans, z_trans = row
                position = (float(x_trans), float(y_trans), float(z_trans))
                
                other_node = OtherNode(
                    id=node_id,
                    ref_id=ref_id,
                    label=label,
                    description=description,
                    info=info or "",
                    image=image or "",
                    node_type=node_type,
                    position=position
                )
                other_nodes.append(other_node)
            
            connection.close()
            logger.info(f"Loaded {len(other_nodes)} other_nodes")
            return other_nodes
            
        except sqlite3.Error as e:
            logger.error(f"Database error loading other_nodes: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading other_nodes: {e}")
            return []
    
    def load_edges(self, all_edges: bool = False) -> List[Edge]:
        """Load edges from the SQLite database"""
        logger.info("Loading edges from database...")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Check table structure
            cursor.execute("PRAGMA table_info(edges)")
            columns = [column[1] for column in cursor.fetchall()]
            has_type = 'type' in columns
            has_zone = 'zone' in columns
            
            if has_type and has_zone:
                if all_edges:
                    query = "SELECT keyframe_id0, keyframe_id1, type, zone FROM edges"
                else:
                    query = "SELECT keyframe_id0, keyframe_id1, type, zone FROM edges WHERE type >= 0"
                logger.info("Loading edges with type and zone information")
            else:
                query = "SELECT keyframe_id0, keyframe_id1 FROM edges"
                logger.info("Loading basic edge structure")
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            edges = []
            for row in tqdm(rows, desc="Loading edges"):
                if len(row) >= 4:
                    keyframe_id0, keyframe_id1, edge_type, zone = row[0], row[1], row[2], row[3]
                    edge = Edge(keyframe_id0, keyframe_id1, edge_type, zone)
                else:
                    keyframe_id0, keyframe_id1 = row[0], row[1]
                    edge = Edge(keyframe_id0, keyframe_id1)
                
                edges.append(edge)
            
            connection.close()
            logger.info(f"Loaded {len(edges)} edges")
            return edges
            
        except sqlite3.Error as e:
            logger.error(f"Database error loading edges: {e}")
            return []
        except Exception as e:
            logger.error(f"Error loading edges: {e}")
            return []
    
    def load_elevator_shafts(self) -> Dict[str, List[int]]:
        """Load elevator shafts from the SQLite database, grouped by shaft_id"""
        logger.info("Loading elevator shafts from database...")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Check if elevator_shafts table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='elevator_shafts'")
            if not cursor.fetchone():
                logger.info("elevator_shafts table not found, skipping...")
                connection.close()
                return {}
            
            query = "SELECT other_node_id, shaft_id FROM elevator_shafts"
            logger.info(f"Executing: {query}")
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Group by shaft_id
            shafts = {}
            for other_node_id, shaft_id in rows:
                if shaft_id not in shafts:
                    shafts[shaft_id] = []
                shafts[shaft_id].append(other_node_id)
            
            connection.close()
            logger.info(f"Loaded {len(shafts)} elevator shafts with {sum(len(nodes) for nodes in shafts.values())} total nodes")
            return shafts
            
        except sqlite3.Error as e:
            logger.error(f"Database error loading elevator shafts: {e}")
            return {}
        except Exception as e:
            logger.error(f"Error loading elevator shafts: {e}")
            return {}
    
    def create_node_mapping(self):
        """Create mapping between node IDs and indices"""
        logger.info("Creating node mapping...")
        
        self.node_mapping.clear()
        self.idx_to_id.clear()
        self.pos_map.clear()
        
        # Map main nodes
        for i, node in enumerate(self.nodes):
            self.node_mapping[node.keyframe_id] = i
            self.idx_to_id[i] = node.keyframe_id
            
            # Create position mapping for picking
            pos_str = f"[{node.position[0]:.4f}, {node.position[1]:.4f}, {node.position[2]:.4f}]"
            self.pos_map[pos_str] = i
        
        # Map other nodes
        start_idx = len(self.nodes)
        for i, other_node in enumerate(self.other_nodes):
            # Use special ID format for other nodes
            special_id = f"other_{other_node.id}"
            self.node_mapping[special_id] = start_idx + i
            self.idx_to_id[start_idx + i] = special_id
            
            # Add to position mapping
            pos_str = f"[{other_node.position[0]:.4f}, {other_node.position[1]:.4f}, {other_node.position[2]:.4f}]"
            self.pos_map[pos_str] = start_idx + i
        
        logger.info(f"Created mapping for {len(self.node_mapping)} total nodes")
    
    def get_lines_from_ids(self, edge_id0: int, edge_id1: int) -> Optional[List[Node]]:
        """Get line points for edge rendering"""
        # Handle both regular nodes and other nodes
        if edge_id0 in self.node_mapping and edge_id1 in self.node_mapping:
            idx0 = self.node_mapping[edge_id0]
            idx1 = self.node_mapping[edge_id1]
            
            # Check if indices are valid
            if idx0 < len(self.nodes) and idx1 < len(self.nodes):
                return [self.nodes[idx0], self.nodes[idx1]]
            elif idx0 >= len(self.nodes) and idx1 >= len(self.nodes):
                # Both are other nodes
                other_idx0 = idx0 - len(self.nodes)
                other_idx1 = idx1 - len(self.nodes)
                if other_idx0 < len(self.other_nodes) and other_idx1 < len(self.other_nodes):
                    # Convert other nodes to Node objects for line drawing
                    other0 = self.other_nodes[other_idx0]
                    other1 = self.other_nodes[other_idx1]
                    # Create dummy nodes for line drawing
                    dummy_pose = np.eye(4, dtype=np.double)
                    node0 = Node(f"other_{other0.id}", other0.position, dummy_pose)
                    node1 = Node(f"other_{other1.id}", other1.position, dummy_pose)
                    return [node0, node1]
        
        logger.warning(f"Edge references non-existent nodes: {edge_id0} -> {edge_id1}")
        return None
    
    def picked_point(self, picked):
        """Handle point picking interaction"""
        pos = f"[{picked[0]:.3f}, {picked[1]:.3f}, {picked[2]:.3f}]"
        if pos not in self.pos_map:
            logger.debug(f"Position not in pos_map: {pos}")
            return
        
        pos_idx = self.pos_map[pos]
        node_id = self.idx_to_id[pos_idx]
        
        if node_id is not None and node_id != -1:
            self.picked_id = node_id
            logger.info(f"Selected node: {node_id}")
    
    def show_neighbours(self):
        """Show neighbours of selected point within proximity"""
        if self.picked_id == -1 or self.picked_id is None:
            logger.warning("No point selected")
            return
        
        logger.info(f"Finding neighbours for node: {self.picked_id}")
        
        # Clear previous neighbour visualisation
        for actor in self.temp_viewed_mesh:
            self.plotter.remove_actor(actor)
        self.temp_viewed_mesh.clear()
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            connection.create_function('sqrt', 1, math.sqrt)
            connection.create_function('pow', 2, math.pow)
            
            # Find neighbours within proximity
            query = """
            WITH target_point AS (
                SELECT x_trans, y_trans, z_trans
                FROM nodes
                WHERE keyframe_id = ?
            )
            SELECT rn.keyframe_id, rn.x_trans, rn.y_trans, rn.z_trans
            FROM nodes rn
            JOIN target_point ON (
                sqrt(pow(rn.x_trans - target_point.x_trans, 2) +
                     pow(rn.z_trans - target_point.z_trans, 2) +
                     pow(rn.y_trans - target_point.y_trans, 2)) <= ?
            )
            WHERE rn.keyframe_id != ?
            """
            
            results = list(cursor.execute(query, (self.picked_id, self.proximity, self.picked_id)))
            
            if results:
                positions = [result[1:4] for result in results]
                points = pv.PolyData(positions)
                actor = self.plotter.add_mesh(
                    points, 
                    render_points_as_spheres=True, 
                    point_size=10.0, 
                    color='yellow'
                )
                self.temp_viewed_mesh.append(actor)
                logger.info(f"Found {len(results)} neighbours")
            else:
                logger.info("No neighbours found within proximity")
            
            connection.close()
            
        except sqlite3.Error as e:
            logger.error(f"Database error finding neighbours: {e}")
        except Exception as e:
            logger.error(f"Error finding neighbours: {e}")
    
    def store_point(self):
        """Store first point for edge creation"""
        if self.picked_id == -1 or self.picked_id is None:
            logger.warning("No point selected")
            return
        
        self.second_id = self.picked_id
        logger.info(f"Stored point: {self.second_id}")
    
    def connect_points(self):
        """Connect two selected points with an edge"""
        if (self.second_id == -1 or self.second_id is None or 
            self.picked_id == -1 or self.picked_id is None or 
            self.picked_id == self.second_id):
            logger.warning("Invalid points for connection")
            return
        
        logger.info(f"Connecting {self.picked_id} to {self.second_id}")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Get zone information
            cursor.execute("SELECT zone FROM nodes WHERE keyframe_id = ?", (int(self.picked_id),))
            result = cursor.fetchone()
            zone = result[0] if result else None
            
            # Insert edge (bidirectional)
            cursor.execute("""
                INSERT INTO edges (keyframe_id0, keyframe_id1, type, zone) 
                VALUES (?, ?, ?, ?) 
                ON CONFLICT (keyframe_id0, keyframe_id1) 
                DO UPDATE SET type=? WHERE type = ?
            """, (self.picked_id, self.second_id, EdgeType.EDGE_CONTRACTION, zone, 
                  EdgeType.EDGE_CONTRACTION, EdgeType.COVISIBILITY))
            
            cursor.execute("""
                INSERT INTO edges (keyframe_id0, keyframe_id1, type, zone) 
                VALUES (?, ?, ?, ?) 
                ON CONFLICT (keyframe_id0, keyframe_id1) 
                DO UPDATE SET type=? WHERE type = ?
            """, (self.second_id, self.picked_id, EdgeType.EDGE_CONTRACTION, zone,
                  EdgeType.EDGE_CONTRACTION, EdgeType.COVISIBILITY))
            
            if cursor.rowcount > 0:
                logger.info("Edge created successfully")
            
            connection.commit()
            connection.close()
            
        except sqlite3.Error as e:
            logger.error(f"Database error creating edge: {e}")
        except Exception as e:
            logger.error(f"Error creating edge: {e}")
    
    def remove_point(self):
        """Mark selected point for removal"""
        if self.picked_id == -1:
            logger.warning("No point selected")
            return
        
        self.removeable_ids.append(self.picked_id)
        logger.info(f"Marked {self.picked_id} for removal")
    
    def export_changes(self):
        """Execute pending changes to database"""
        if not self.removeable_ids:
            logger.info("No changes to export")
            return
        
        logger.info(f"Exporting changes: removing {len(self.removeable_ids)} nodes")
        
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Prepare deletion data
            delete_edges = [(int(id), int(id)) for id in self.removeable_ids]
            delete_nodes = [(int(id),) for id in self.removeable_ids]
            
            # Execute deletions
            cursor.executemany("DELETE FROM edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?", delete_edges)
            cursor.executemany("DELETE FROM node_locations WHERE keyframe_id = ?", delete_nodes)
            cursor.executemany("DELETE FROM other_nodes WHERE ref_id = ?", delete_nodes)
            cursor.executemany("DELETE FROM nodes WHERE keyframe_id = ?", delete_nodes)
            
            # Confirm before committing
            confirmed = input("Confirm removal (y/N): ")
            if confirmed.lower() in ['y', 'yes']:
                connection.commit()
                logger.info("Changes committed successfully")
                self.removeable_ids.clear()
            else:
                logger.info("Changes cancelled")
                connection.rollback()
            
            connection.close()
            
        except sqlite3.Error as e:
            logger.error(f"Database error exporting changes: {e}")
        except Exception as e:
            logger.error(f"Error exporting changes: {e}")
    
    def toggle_edges(self):
        """Toggle edge visibility"""
        if not self.edge_actors:
            logger.warning("No edges to toggle")
            return
        
        for actor in self.edge_actors:
            if actor.GetVisibility():
                actor.SetVisibility(False)
            else:
                actor.SetVisibility(True)
        
        self.plotter.render()
        logger.info("Toggled edge visibility")
    
    def render(self):
        """Render the 3D visualisation"""
        logger.info("Starting 3D rendering...")
        
        # Create plotter
        self.plotter = pv.Plotter()
        
        # Create node mappings
        self.create_node_mapping()
        
        # Render main nodes
        logger.info("Rendering main nodes...")
        for node in tqdm(self.nodes, desc="Rendering nodes"):
            arrow = node.get_arrow()
            self.plotter.add_mesh(arrow, color="green", pickable=True)
        
        # Render other nodes
        if self.other_nodes:
            logger.info("Rendering other nodes...")
            for other_node in tqdm(self.other_nodes, desc="Rendering other_nodes"):
                sphere = other_node.get_sphere()
                color = self.node_type_colors.get(other_node.node_type, "blue")
                self.plotter.add_mesh(sphere, color=color, pickable=True)
                
                # Add type labels
                type_names = {0: "N", 1: "E", 2: "I", 3: "R"}
                if other_node.node_type != 0:
                    type_label = type_names.get(other_node.node_type, "?")
                    self.plotter.add_point_labels(
                        other_node.position, 
                        [type_label], 
                        font_size=8, 
                        point_size=8
                    )
        
        # Add legend
        legend_entries = [
            ("N", "Normal node"),
            ("E", "Elevator node"), 
            ("I", "Info/Toilet node"),
            ("R", "Room node")
        ]
        legend_text = "\n".join([f"{symbol}: {description}" for symbol, description in legend_entries])
        self.plotter.add_text(legend_text, position='upper_left', font_size=12, color='black')
        
        # Render edges
        if self.show_edges and self.edges:
            logger.info("Rendering edges...")
            valid_edges = 0
            invalid_edges = 0
            
            for edge in tqdm(self.edges, desc="Rendering edges"):
                line_points = self.get_lines_from_ids(edge.keyframe_id0, edge.keyframe_id1)
                if line_points is not None:
                    p0, p1 = line_points
                    line = pv.Line(p0.position, p1.position)
                    
                    color = self.edge_type_colors.get(edge.edge_type, "gray")
                    line_width = 2.0 if edge.edge_type == EdgeType.EDGE_CONTRACTION else 1.0
                    
                    actor = self.plotter.add_mesh(
                        line, 
                        color=color, 
                        line_width=line_width, 
                        pickable=False
                    )
                    self.edge_actors.append(actor)
                    valid_edges += 1
                else:
                    invalid_edges += 1
            
            logger.info(f"Rendered {valid_edges} valid edges, skipped {invalid_edges} invalid edges")
        
        # Render elevator shafts (create edges between all nodes in the same shaft)
        if self.elevator_shafts:
            logger.info("Rendering elevator shafts...")
            elevator_valid = 0
            elevator_invalid = 0
            
            for shaft_id, node_ids in tqdm(self.elevator_shafts.items(), desc="Rendering elevator shafts"):
                # Create edges between all pairs of nodes in the same shaft
                for i in range(len(node_ids)):
                    for j in range(i + 1, len(node_ids)):
                        node_id0, node_id1 = node_ids[i], node_ids[j]
                        # Use special ID format for other nodes
                        special_id0 = f"other_{node_id0}"
                        special_id1 = f"other_{node_id1}"
                        line_points = self.get_lines_from_ids(special_id0, special_id1)
                        
                        if line_points is not None:
                            p0, p1 = line_points
                            line = pv.Line(p0.position, p1.position)
                            actor = self.plotter.add_mesh(
                                line, 
                                color="cyan", 
                                line_width=3.0, 
                                pickable=False
                            )
                            self.edge_actors.append(actor)
                            elevator_valid += 1
                        else:
                            elevator_invalid += 1
            
            logger.info(f"Rendered {elevator_valid} valid elevator edges, skipped {elevator_invalid} invalid edges")
        
        # Add axes and controls
        self.plotter.add_axes(interactive=True)
        self.plotter.add_axes_at_origin(labels_off=True)
        
        # Set up interactions
        self.plotter.enable_point_picking(callback=self.picked_point)
        self.plotter.add_key_event('d', callback=self.remove_point)
        self.plotter.add_key_event('e', callback=self.export_changes)
        self.plotter.add_key_event('n', callback=self.show_neighbours)
        self.plotter.add_key_event('1', callback=self.store_point)
        self.plotter.add_key_event('2', callback=self.connect_points)
        self.plotter.add_key_event('t', callback=self.toggle_edges)
        
        # Show controls
        controls_text = """
Controls:
p - select point (click interaction)
d - mark selected point for removal
1 - store first point for edge creation
2 - connect stored point to current selection
e - execute pending changes
n - show neighbours of selected point
t - toggle edge visibility
        """
        self.plotter.add_text(controls_text, position='lower_left', font_size=10, color='black')
        
        logger.info("Rendering complete. Starting interactive session...")
        self.plotter.show()
    
    def run(self):
        """Main execution method"""
        logger.info(f"Starting SQLiteViewer with database: {self.db_path}")
        
        # Load data
        self.nodes = self.load_nodes()
        self.other_nodes = self.load_other_nodes()
        self.edges = self.load_edges()
        self.elevator_shafts = self.load_elevator_shafts()
        
        if not self.nodes:
            logger.error("No nodes loaded. Exiting.")
            return
        
        # Print summary
        logger.info(f"Data loaded:")
        logger.info(f"  - {len(self.nodes)} nodes")
        logger.info(f"  - {len(self.other_nodes)} other nodes")
        logger.info(f"  - {len(self.edges)} edges")
        total_shaft_nodes = sum(len(nodes) for nodes in self.elevator_shafts.values())
        logger.info(f"  - {len(self.elevator_shafts)} elevator shafts ({total_shaft_nodes} nodes)")
        
        # Render
        self.render()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="SQLiteViewer - 3D Visualisation Tool for Spatial Graph Data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python viewer.py database.db
  python viewer.py database.db --proximity 0.2 --no-edges
  python viewer.py database.db --verbose
        """
    )
    
    parser.add_argument('database', help='Path to SQLite database file')
    parser.add_argument('--proximity', type=float, default=DEFAULT_PROXIMITY,
                       help=f'Neighbour detection radius (default: {DEFAULT_PROXIMITY})')
    parser.add_argument('--no-edges', action='store_true',
                       help='Disable edge rendering')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate database file
    if not os.path.exists(args.database):
        logger.error(f"Database file not found: {args.database}")
        sys.exit(1)
    
    # Create and run viewer
    viewer = SQLiteViewer(
        db_path=args.database,
        proximity=args.proximity,
        show_edges=not args.no_edges
    )
    
    try:
        viewer.run()
    except KeyboardInterrupt:
        logger.info("Viewer interrupted by user")
    except Exception as e:
        logger.error(f"Viewer error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import os
    main()


