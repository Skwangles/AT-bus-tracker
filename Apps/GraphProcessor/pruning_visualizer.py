#!/usr/bin/env python3
"""
Pruning Visualizer - A tool to visualize and validate graph pruning results.
"""

import sqlite3
import numpy as np
import networkx as nx
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import logging
from typing import Dict, List, Tuple, Set
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PruningVisualizer:
    """Visualizer for graph pruning results with connectivity validation."""
    
    def __init__(self, db_path: str):
        """Initialize the visualizer with a database path."""
        self.db_path = Path(db_path)
        self.nodes = {}
        self.edges = []
        self.graph = None
        
    def load_graph_data(self):
        """Load nodes and edges from the database."""
        if not self.db_path.exists():
            logger.error(f"Database file not found: {self.db_path}")
            return False
            
        try:
            connection = sqlite3.connect(self.db_path)
            cursor = connection.cursor()
            
            # Load nodes
            cursor.execute("SELECT keyframe_id, x_trans, y_trans, z_trans FROM nodes")
            nodes_data = cursor.fetchall()
            
            for node_id, x, y, z in nodes_data:
                self.nodes[node_id] = {'x': x, 'y': y, 'z': z}
            
            # Load edges
            cursor.execute("SELECT keyframe_id0, keyframe_id1 FROM edges")
            edges_data = cursor.fetchall()
            
            for node1, node2 in edges_data:
                self.edges.append((node1, node2))
            
            connection.close()
            
            logger.info(f"Loaded {len(self.nodes)} nodes and {len(self.edges)} edges")
            return True
            
        except Exception as e:
            logger.error(f"Error loading graph data: {e}")
            return False
    
    def build_networkx_graph(self):
        """Build a NetworkX graph from the loaded data."""
        self.graph = nx.Graph()
        
        # Add nodes
        for node_id in self.nodes.keys():
            self.graph.add_node(node_id)
        
        # Add edges
        for node1, node2 in self.edges:
            if node1 in self.nodes and node2 in self.nodes:
                self.graph.add_edge(node1, node2)
            else:
                logger.warning(f"Edge references non-existent nodes: {node1} -> {node2}")
        
        logger.info(f"Built NetworkX graph with {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges")
    
    def validate_connectivity(self) -> Dict:
        """Validate the connectivity of the graph."""
        if not self.graph:
            self.build_networkx_graph()
        
        # Check if graph is connected
        is_connected = nx.is_connected(self.graph)
        num_components = nx.number_connected_components(self.graph)
        
        # Get component sizes
        components = list(nx.connected_components(self.graph))
        component_sizes = [len(comp) for comp in components]
        
        # Calculate statistics
        stats = {
            'is_connected': is_connected,
            'num_components': num_components,
            'component_sizes': component_sizes,
            'largest_component_size': max(component_sizes) if component_sizes else 0,
            'total_nodes': self.graph.number_of_nodes(),
            'total_edges': self.graph.number_of_edges(),
            'average_degree': sum(dict(self.graph.degree()).values()) / self.graph.number_of_nodes() if self.graph.number_of_nodes() > 0 else 0
        }
        
        logger.info(f"Connectivity validation:")
        logger.info(f"  Connected: {is_connected}")
        logger.info(f"  Components: {num_components}")
        logger.info(f"  Component sizes: {component_sizes}")
        logger.info(f"  Largest component: {stats['largest_component_size']} nodes")
        logger.info(f"  Average degree: {stats['average_degree']:.2f}")
        
        return stats
    
    def find_orphaned_nodes(self) -> List[int]:
        """Find nodes that have no edges."""
        if not self.graph:
            self.build_networkx_graph()
        
        orphaned = []
        for node_id in self.nodes.keys():
            if self.graph.degree(node_id) == 0:
                orphaned.append(node_id)
        
        logger.info(f"Found {len(orphaned)} orphaned nodes: {orphaned[:10]}{'...' if len(orphaned) > 10 else ''}")
        return orphaned
    
    def find_invalid_edges(self) -> List[Tuple[int, int]]:
        """Find edges that reference non-existent nodes."""
        invalid_edges = []
        for node1, node2 in self.edges:
            if node1 not in self.nodes or node2 not in self.nodes:
                invalid_edges.append((node1, node2))
        
        logger.info(f"Found {len(invalid_edges)} invalid edges")
        return invalid_edges
    
    def visualize_3d(self, save_path: str = None, show_components: bool = True):
        """Create a 3D visualization of the graph."""
        if not self.graph:
            self.build_networkx_graph()
        
        # Create figure
        fig = plt.figure(figsize=(12, 10))
        ax = fig.add_subplot(111, projection='3d')
        
        # Extract coordinates
        x_coords = [self.nodes[node_id]['x'] for node_id in self.nodes.keys()]
        y_coords = [self.nodes[node_id]['y'] for node_id in self.nodes.keys()]
        z_coords = [self.nodes[node_id]['z'] for node_id in self.nodes.keys()]
        
        # Plot nodes
        if show_components:
            # Color nodes by component
            components = list(nx.connected_components(self.graph))
            colors = plt.cm.tab20(np.linspace(0, 1, len(components)))
            
            for i, component in enumerate(components):
                comp_x = [self.nodes[node_id]['x'] for node_id in component]
                comp_y = [self.nodes[node_id]['y'] for node_id in component]
                comp_z = [self.nodes[node_id]['z'] for node_id in component]
                
                ax.scatter(comp_x, comp_y, comp_z, c=[colors[i]], s=50, alpha=0.7, label=f'Component {i+1}')
        else:
            ax.scatter(x_coords, y_coords, z_coords, c='blue', s=50, alpha=0.7)
        
        # Plot edges
        for node1, node2 in self.graph.edges():
            if node1 in self.nodes and node2 in self.nodes:
                x1, y1, z1 = self.nodes[node1]['x'], self.nodes[node1]['y'], self.nodes[node1]['z']
                x2, y2, z2 = self.nodes[node2]['x'], self.nodes[node2]['y'], self.nodes[node2]['z']
                ax.plot([x1, x2], [y1, y2], [z1, z2], 'k-', alpha=0.3, linewidth=0.5)
        
        # Set labels and title
        ax.set_xlabel('X')
        ax.set_ylabel('Y')
        ax.set_zlabel('Z')
        ax.set_title(f'Graph Visualization\n{self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges')
        
        if show_components:
            ax.legend()
        
        # Save or show
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            logger.info(f"Saved visualization to {save_path}")
        else:
            plt.show()
        
        plt.close()
    
    def print_detailed_stats(self):
        """Print detailed statistics about the graph."""
        if not self.graph:
            self.build_networkx_graph()
        
        print("\n" + "="*60)
        print("GRAPH PRUNING VALIDATION REPORT")
        print("="*60)
        
        # Basic stats
        print(f"Total nodes: {len(self.nodes)}")
        print(f"Total edges: {len(self.edges)}")
        print(f"Valid edges in graph: {self.graph.number_of_edges()}")
        
        # Connectivity
        stats = self.validate_connectivity()
        print(f"\nConnectivity:")
        print(f"  Fully connected: {stats['is_connected']}")
        print(f"  Number of components: {stats['num_components']}")
        print(f"  Component sizes: {stats['component_sizes']}")
        
        # Edge analysis
        invalid_edges = self.find_invalid_edges()
        orphaned_nodes = self.find_orphaned_nodes()
        
        print(f"\nEdge Analysis:")
        print(f"  Invalid edges: {len(invalid_edges)}")
        if invalid_edges:
            print(f"  First 5 invalid edges: {invalid_edges[:5]}")
        
        print(f"\nNode Analysis:")
        print(f"  Orphaned nodes: {len(orphaned_nodes)}")
        if orphaned_nodes:
            print(f"  First 10 orphaned nodes: {orphaned_nodes[:10]}")
        
        # Degree distribution
        degrees = [self.graph.degree(node) for node in self.graph.nodes()]
        print(f"\nDegree Distribution:")
        print(f"  Average degree: {np.mean(degrees):.2f}")
        print(f"  Min degree: {min(degrees)}")
        print(f"  Max degree: {max(degrees)}")
        print(f"  Nodes with degree 0: {degrees.count(0)}")
        print(f"  Nodes with degree 1: {degrees.count(1)}")
        
        print("="*60)

def main():
    """Main function to run the visualizer."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Visualize and validate graph pruning results')
    parser.add_argument('db_path', help='Path to the database file')
    parser.add_argument('--save-plot', help='Path to save the visualization plot')
    parser.add_argument('--no-components', action='store_true', help='Don\'t color nodes by component')
    
    args = parser.parse_args()
    
    # Create visualizer
    visualizer = PruningVisualizer(args.db_path)
    
    # Load data
    if not visualizer.load_graph_data():
        logger.error("Failed to load graph data")
        return
    
    # Print detailed statistics
    visualizer.print_detailed_stats()
    
    # Create visualization
    visualizer.visualize_3d(
        save_path=args.save_plot,
        show_components=not args.no_components
    )

if __name__ == "__main__":
    main()



