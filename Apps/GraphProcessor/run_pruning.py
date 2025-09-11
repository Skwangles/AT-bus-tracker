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



async def run_grid_pruning(db_path: str, sharpness_json_path: str, grid_size: float = 5.0, coords_to_metres: float = 15.0, verbose: bool = False, prefix: str = "pruned_"):
    """
    Run grid-based pruning approach using spatial grid partitioning.
    
    Args:
        db_path: Path to the database file
        sharpness_json_path: Path to the sharpness JSON file
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
        coords_to_metres=coords_to_metres
    )
    
    # Create working copy of the database
    logger.info(f"Creating working copy of database: {db_path}")
    db_manager = DatabaseManager(db_path, config)
    working_db_path = db_manager.create_working_copy(prefix)
    
    # Create database manager for working copy
    working_db_manager = DatabaseManager(working_db_path, config)
    working_db_manager.connect()
    
    # Create and run grid pruner
    grid_pruner = GridBasedPruner(working_db_manager, coords_to_metres)
    
    # Load sharpness data
    if not os.path.exists(sharpness_json_path):
        logger.error(f"Sharpness file not found: {sharpness_json_path}")
        return None, 0.0
    
    logger.info(f"Loading sharpness data from {sharpness_json_path}")
    if not grid_pruner.load_sharpness_data(sharpness_json_path):
        logger.error(f"Failed to load sharpness data from {sharpness_json_path}")
        return None, 0.0
    
    # Load graph data
    if not grid_pruner.load_graph_data():
        logger.error("Failed to load graph data")
        return None, 0.0
    
    # Perform grid-based pruning
    result = grid_pruner.grid_based_pruning(grid_size)
    
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
    logger.info(f"Connectivity maintained: {result['connectivity_maintained']}")
    
    logger.info(f"Working copy saved to: {working_db_path}")
    
    return result


async def main():
    """Main function with command line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Graph pruning using grid-based spatial partitioning',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run grid-based pruning with default 5x5x5m grid
  python run_pruning.py prune cv.db --sharpness-json sharpness.json
  
  # Run grid-based pruning with custom grid size
  python run_pruning.py prune cv.db --sharpness-json sharpness.json --grid-size 3.0
  
  # Run grid-based pruning with custom scaling factor
  python run_pruning.py prune cv.db --sharpness-json sharpness.json --coords-to-metres 20.0
  
        """
    )
    
    parser.add_argument('mode', choices=['prune'],
                       help='Operation mode: prune the graph')
    parser.add_argument('db_path', help='Path to the database file')
    parser.add_argument('--sharpness-json', required=True,
                       help='Path to the sharpness JSON file (required)')
    parser.add_argument('--grid-size', type=float, default=5.0,
                       help='Grid box size in metres (default: 5.0m)')
    parser.add_argument('--coords-to-metres', type=float, default=15.0,
                       help='Scale factor to convert coordinates to metres (default: 15.0)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--db-prefix', type=str, default="pruned_",
                       help='Prefix for the database file (default: pruned_)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.db_path):
        print(f"Error: Database file not found: {args.db_path}")
        return 1
    
    if not os.path.exists(args.sharpness_json):
        print(f"Error: Sharpness JSON file not found: {args.sharpness_json}")
        return 1
    
    try:
        if args.mode == 'prune':
            await run_grid_pruning(args.db_path, args.sharpness_json, args.grid_size, args.coords_to_metres, args.verbose, args.db_prefix)

        
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
