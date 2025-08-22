#!/usr/bin/env python3
"""
Advanced graph pruning runner for the refined approach.

This script provides easy-to-use functions for different pruning strategies
using the new advanced pruner with hierarchical clustering and MST-based approaches.
"""

import os
import sys
import logging
from pathlib import Path

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Config
from db_manager import DatabaseManager
from grid_pruner import GridBasedPruner
from coverage_validator import CoverageValidator
from pruning_visualizer import PruningVisualizer

def setup_logging(verbose: bool = False):
    """Set up logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('advanced_graph_pruning.log')
        ]
    )



async def run_grid_pruning(db_path: str, grid_size: float = 5.0, coords_to_metres: float = 15.0, verbose: bool = False, db_prefix: str = "refined_"):
    """
    Run grid-based pruning approach using spatial grid partitioning.
    
    Args:
        db_path: Path to the database file
        grid_size: Size of each grid box in metres (default: 5.0m)
        coords_to_metres: Scale factor to convert coordinates to metres (default: 15.0)
        verbose: Whether to enable verbose logging
    """
    setup_logging(verbose)
    logger = logging.getLogger(__name__)
    
    logger.info(f"Running grid-based pruning with {grid_size}x{grid_size}x{grid_size}m grid boxes...")
    
    # Configuration for grid pruning
    config = Config(
        outer_ring=grid_size,
        inner_ring=grid_size * 0.1,  # 10% of grid size
        coords_to_metres=coords_to_metres,
        table_prefix=db_prefix
    )
    
    # Create working copy of the database
    logger.info(f"Creating working copy of database: {db_path}")
    db_manager = DatabaseManager(db_path, config)
    working_db_path = db_manager.create_working_copy(db_prefix)
    
    # Create database manager for working copy
    working_db_manager = DatabaseManager(working_db_path, config)
    working_db_manager.connect()
    
    # Create and run grid pruner
    grid_pruner = GridBasedPruner(working_db_manager, coords_to_metres)
    
    # Load sharpness data if available
    sharpness_json_path = f"{db_prefix}sharpness.json" if db_prefix else "sharpness.json"
    if os.path.exists(sharpness_json_path):
        logger.info(f"Loading sharpness data from {sharpness_json_path}")
        grid_pruner.load_sharpness_data(sharpness_json_path)
    else:
        logger.warning(f"Sharpness file not found: {sharpness_json_path}. Using default sharpness values.")
    
    # Load graph data
    if not grid_pruner.load_graph_data():
        logger.error("Failed to load graph data")
        return None, 0.0
    
    # Perform grid-based pruning
    result = grid_pruner.grid_based_pruning(grid_size)
    
    # Validate coverage (using scaled coordinates)
    coverage_validator = CoverageValidator(coverage_distance=grid_size)
    # Convert nodes back to scaled coordinates for coverage validation
    scaled_nodes = {}
    for node_id, node_data in grid_pruner.nodes.items():
        if node_id in [rep for rep in grid_pruner.representatives.values()]:
            scaled_nodes[node_id] = node_data
    
    coverage_validator.set_graph_data(scaled_nodes)
    is_covered, coverage_score, uncovered_points = coverage_validator.validate_coverage()
    
    # Save results
    await grid_pruner.save_to_database()
    
    # Log results
    logger.info("=== GRID PRUNING RESULTS ===")
    logger.info(f"Original nodes: {result['original_nodes']}")
    logger.info(f"Final nodes: {result['final_nodes']}")
    logger.info(f"Node reduction: {result['node_reduction_percent']:.1f}%")
    logger.info(f"Original edges: {result['original_edges']}")
    logger.info(f"Final edges: {result['final_edges']}")
    logger.info(f"Edge reduction: {result['edge_reduction_percent']:.1f}%")
    logger.info(f"Grid boxes created: {result['grid_boxes_created']}")
    logger.info(f"Grid size: {result['grid_size_metres']}m")
    logger.info(f"Coordinate scaling: {result['coords_to_metres_scale']}x")
    logger.info(f"Coverage score: {coverage_score:.3f}")
    logger.info(f"Connectivity maintained: {result['connectivity_maintained']}")
    logger.info(f"Coverage validation: {'PASS' if is_covered else 'FAIL'}")
    
    if not is_covered:
        logger.warning(f"Coverage gaps detected: {len(uncovered_points)} uncovered points")
    
    logger.info(f"Working copy saved to: {working_db_path}")
    
    # Visualize and validate the results
    logger.info("Running visualization and validation...")
    visualizer = PruningVisualizer(working_db_path)
    if visualizer.load_graph_data():
        visualizer.print_detailed_stats()
        
        # Save visualization
        plot_path = working_db_path.replace('.db', '_visualization.png')
        visualizer.visualize_3d(save_path=plot_path, show_components=True)
        logger.info(f"Visualization saved to: {plot_path}")
    else:
        logger.error("Failed to load graph data for visualization")
    
    return result, coverage_score

def analyze_graph_coverage(db_path: str, grid_size: float = 5.0, coords_to_metres: float = 15.0, verbose: bool = False):
    """
    Analyze graph coverage without making changes.
    
    Args:
        db_path: Path to the database file
        grid_size: Grid size for analysis reference (default: 5.0m)
        coords_to_metres: Scale factor to convert coordinates to metres (default: 15.0)
        verbose: Whether to enable verbose logging
    """
    setup_logging(verbose)
    logger = logging.getLogger(__name__)
    
    logger.info("Analyzing graph coverage...")
    
    # Configuration
    config = Config(
        outer_ring=grid_size,
        inner_ring=0.5,
        coords_to_metres=coords_to_metres
    )
    
    # Create database manager
    db_manager = DatabaseManager(db_path, config)
    db_manager.connect()
    
    # Create grid pruner for analysis (without actually pruning)
    grid_pruner = GridBasedPruner(db_manager, coords_to_metres)
    
    # Load sharpness data if available
    sharpness_json_path = "sharpness.json"
    if os.path.exists(sharpness_json_path):
        logger.info(f"Loading sharpness data from {sharpness_json_path}")
        grid_pruner.load_sharpness_data(sharpness_json_path)
    else:
        logger.warning(f"Sharpness file not found: {sharpness_json_path}. Using default sharpness values.")
    
    if not grid_pruner.load_graph_data():
        logger.error("Failed to load graph data")
        return None, None
    
    # Analyze coverage
    coverage_validator = CoverageValidator(coverage_distance=grid_size)
    coverage_validator.set_graph_data(grid_pruner.nodes)
    
    is_covered, coverage_score, uncovered_points = coverage_validator.validate_coverage()
    stats = coverage_validator.calculate_coverage_statistics()
    
    # Generate coverage report
    report = coverage_validator.generate_coverage_report()
    
    logger.info("=== COVERAGE ANALYSIS ===")
    logger.info(report)
    logger.info(f"Total nodes: {len(grid_pruner.nodes)}")
    logger.info(f"Total edges: {len(grid_pruner.edges)}")
    logger.info(f"Coverage score: {coverage_score:.3f}")
    
    if not is_covered:
        logger.warning("Coverage gaps detected!")
        logger.info(f"Uncovered points: {len(uncovered_points)}")
    
    return stats, uncovered_points

async def main():
    """Main function with command line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Graph pruning using grid-based spatial partitioning',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run grid-based pruning with default 5x5x5m grid
  python run_pruning.py prune cv.db
  
  # Run grid-based pruning with custom grid size
  python run_pruning.py prune cv.db --grid-size 3.0
  
  # Run grid-based pruning with custom scaling factor
  python run_pruning.py prune cv.db --coords-to-metres 20.0
  
  # Analyze coverage without changes
  python run_pruning.py analyze cv.db
        """
    )
    
    parser.add_argument('mode', choices=['prune', 'analyze'],
                       help='Operation mode: prune the graph or analyze coverage')
    parser.add_argument('db_path', help='Path to the database file')
    parser.add_argument('--grid-size', type=float, default=5.0,
                       help='Grid box size in metres (default: 5.0m)')
    parser.add_argument('--coords-to-metres', type=float, default=15.0,
                       help='Scale factor to convert coordinates to metres (default: 15.0)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--db-prefix', type=str, default="refined_",
                       help='Prefix for the database file (default: refined_)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.db_path):
        print(f"Error: Database file not found: {args.db_path}")
        return 1
    
    try:
        if args.mode == 'prune':
            await run_grid_pruning(args.db_path, args.grid_size, args.coords_to_metres, args.verbose, args.db_prefix)
        elif args.mode == 'analyze':
            analyze_graph_coverage(args.db_path, args.grid_size, args.coords_to_metres, args.verbose)

        
        print("Operation completed successfully!")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

if __name__ == "__main__":
    import asyncio
    sys.exit(asyncio.run(main()))
