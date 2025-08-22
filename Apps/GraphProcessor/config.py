#!/usr/bin/env python3
"""
Configuration constants for the GraphProcessor module.

This module contains all the default configuration values and constants
used throughout the graph processing system.
"""

import os
from typing import Dict, Any

# Default configuration values
DFLT_COORDS_TO_METRES = 10.0
DFLT_TARGET_CLOSENESS = 5.0
DFLT_ALWAYS_MERGE_CLOSENESS = 0.5
DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS = 1.0
DFLT_OUTDOORS_TARGET_CLOSENESS = 7.0
DFLT_OUTDOORS_Y_DIST_THRESHOLD = 2.0
DFLT_Y_DIST_THRESHOLD = 2.0
DFLT_KEYFRAME_IMG_EXTENSION = ".png"
DFLT_KEYFRAME_IMG_DIR = "pictures/"
DFLT_OUTDOORS_LOCATION_NAME = "outdoors"
DFLT_TABLE_PREFIX = ""
DFLT_USE_SQLITE = True
DFLT_SQLITE_DB_PATH = "cv.db"
DFLT_USE_PRECALCULATED_IMAGE_SHARPNESS = True
DFLT_PREPROCESSED_IMG_SHARPNESS_JSON = "sharpness.json"

# Edge types (matching the TypeScript implementation)
class EdgeType:
    COVISIBILITY = -1
    NORMAL = 0
    LOOP = 1
    MERGE_POINT = 2
    EDGE_CONTRACTION = 3
    PATHFIND = 4

# Node types
class NodeType:
    NORMAL_NODE = 0
    ELEVATOR_NODE = 1
    ANCHOR_NODE = 2

# Other node types
class OtherNodeType:
    OTHER_NORMAL_NODE = 0
    OTHER_ELEVATOR_NODE = 1
    OTHER_TOILET_NODE = 2
    OTHER_INFO_NODE = 3

# Reserved label types
RESERVED_ANCHOR = "!!anchor"
RESERVED_ELEVATOR = "!!elevator"

class Config:
    """
    Configuration class for graph processing parameters.
    
    This class holds all the configuration parameters needed for
    graph pruning and processing operations.
    """
    
    def __init__(self, **kwargs):
        """
        Initialize configuration with default values or provided overrides.
        
        Args:
            **kwargs: Configuration overrides
        """
        # Database configuration
        self.table_prefix = kwargs.get('table_prefix', DFLT_TABLE_PREFIX)
        self.coords_to_metres = kwargs.get('coords_to_metres', DFLT_COORDS_TO_METRES)
        
        # Proximity thresholds
        self.outer_ring = kwargs.get('outer_ring', DFLT_TARGET_CLOSENESS)
        self.inner_ring = kwargs.get('inner_ring', DFLT_ALWAYS_MERGE_CLOSENESS)
        self.otdr_outer_ring = kwargs.get('otdr_outer_ring', DFLT_OUTDOORS_TARGET_CLOSENESS)
        self.otdr_inner_ring = kwargs.get('otdr_inner_ring', DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS)
        
        # Image configuration
        self.img_dir = kwargs.get('img_dir', DFLT_KEYFRAME_IMG_DIR)
        self.img_ext = kwargs.get('img_ext', DFLT_KEYFRAME_IMG_EXTENSION)
        
        # Distance thresholds
        self.y_dist_thresh = kwargs.get('y_dist_thresh', DFLT_Y_DIST_THRESHOLD)
        self.otdr_y_dist_thresh = kwargs.get('otdr_y_dist_thresh', DFLT_OUTDOORS_Y_DIST_THRESHOLD)
        
        # Sharpness configuration
        self.preproc_sharpness_json = kwargs.get('preproc_sharpness_json', DFLT_PREPROCESSED_IMG_SHARPNESS_JSON)
        self.sharpness = kwargs.get('sharpness', {})
        
        # Location configuration
        self.outdoors_location_name = kwargs.get('outdoors_location_name', DFLT_OUTDOORS_LOCATION_NAME)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            'table_prefix': self.table_prefix,
            'coords_to_metres': self.coords_to_metres,
            'outer_ring': self.outer_ring,
            'inner_ring': self.inner_ring,
            'otdr_outer_ring': self.otdr_outer_ring,
            'otdr_inner_ring': self.otdr_inner_ring,
            'img_dir': self.img_dir,
            'img_ext': self.img_ext,
            'y_dist_thresh': self.y_dist_thresh,
            'otdr_y_dist_thresh': self.otdr_y_dist_thresh,
            'preproc_sharpness_json': self.preproc_sharpness_json,
            'outdoors_location_name': self.outdoors_location_name
        }
    
    def __str__(self) -> str:
        """String representation of configuration."""
        return f"Config({', '.join(f'{k}={v}' for k, v in self.to_dict().items())})"
    
    def __repr__(self) -> str:
        """Detailed string representation of configuration."""
        return f"Config(\n" + \
               f"  table_prefix='{self.table_prefix}',\n" + \
               f"  coords_to_metres={self.coords_to_metres},\n" + \
               f"  outer_ring={self.outer_ring},\n" + \
               f"  inner_ring={self.inner_ring},\n" + \
               f"  otdr_outer_ring={self.otdr_outer_ring},\n" + \
               f"  otdr_inner_ring={self.otdr_inner_ring},\n" + \
               f"  img_dir='{self.img_dir}',\n" + \
               f"  img_ext='{self.img_ext}',\n" + \
               f"  y_dist_thresh={self.y_dist_thresh},\n" + \
               f"  otdr_y_dist_thresh={self.otdr_y_dist_thresh},\n" + \
               f"  preproc_sharpness_json='{self.preproc_sharpness_json}',\n" + \
               f"  outdoors_location_name='{self.outdoors_location_name}'\n" + \
               f")"

def load_config_from_env() -> Config:
    """
    Load configuration from environment variables.
    
    Returns:
        Config object with values from environment variables
    """
    return Config(
        table_prefix=os.getenv('CV_PRUNE_TABLE_PREFIX', DFLT_TABLE_PREFIX),
        coords_to_metres=float(os.getenv('CV_COORDS_TO_METRES', str(DFLT_COORDS_TO_METRES))),
        outer_ring=float(os.getenv('CV_PRUNE_TARGET_CLOSENESS', str(DFLT_TARGET_CLOSENESS))),
        inner_ring=float(os.getenv('CV_PRUNE_ALWAYS_MERGE_CLOSENESS', str(DFLT_ALWAYS_MERGE_CLOSENESS))),
        otdr_outer_ring=float(os.getenv('CV_PRUNE_OUTDOORS_TARGET_CLOSENESS', str(DFLT_OUTDOORS_TARGET_CLOSENESS))),
        otdr_inner_ring=float(os.getenv('CV_PRUNE_OUTDOORS_ALWAYS_MERGE_CLOSENESS', str(DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS))),
        img_dir=os.getenv('CV_KEYFRAME_IMG_DIR', DFLT_KEYFRAME_IMG_DIR),
        img_ext=os.getenv('CV_KEYFRAME_IMG_EXTENSION', DFLT_KEYFRAME_IMG_EXTENSION),
        y_dist_thresh=float(os.getenv('CV_PRUNE_Y_DIST_THRESHOLD', str(DFLT_Y_DIST_THRESHOLD))),
        otdr_y_dist_thresh=float(os.getenv('CV_PRUNE_OUTDOORS_Y_DIST_THRESHOLD', str(DFLT_OUTDOORS_Y_DIST_THRESHOLD))),
        preproc_sharpness_json=os.getenv('CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH', DFLT_PREPROCESSED_IMG_SHARPNESS_JSON),
        outdoors_location_name=os.getenv('CV_OUTDOORS_LOCATION_NAME', DFLT_OUTDOORS_LOCATION_NAME)
    )
