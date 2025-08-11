# Advanced Graph Processor

This module implements a refined approach to graph pruning for building walkable paths, using hierarchical clustering and minimum spanning tree techniques.

## Overview

The advanced graph processor addresses the challenges of:
- Redundant connections in cyclic graphs
- Closely spaced nodes from multiple passes
- Maintaining connectivity while reducing complexity
- Ensuring 5m coverage requirements
- Handling parallel branches efficiently

## Key Features

### Hierarchical Clustering Approach
- Groups nearby nodes into spatial clusters
- Selects optimal representative nodes for each cluster
- Maintains connectivity between representatives
- Reduces visual clutter while preserving coverage

### Coverage Validation
- Validates 5m coverage requirement using grid-based testing
- Identifies coverage gaps and suggests improvements
- Provides detailed coverage statistics and reports

### Spatial Indexing
- Efficient proximity queries using KD-trees
- Fast spatial operations for large graphs
- Optimized node selection based on multiple criteria

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your database is accessible and contains the required tables (nodes, edges).

## Usage

### Basic Refined Pruning
```bash
python run_pruning.py refined cv.db
```

### Aggressive Pruning (7m target distance)
```bash
python run_pruning.py aggressive cv.db
```

### Conservative Pruning (3m target distance)
```bash
python run_pruning.py conservative cv.db
```

### Coverage Analysis
```bash
python run_pruning.py analyze cv.db
```

### Compare Old vs New Approaches
```bash
python run_pruning.py compare cv.db
```

### Custom Target Distance
```bash
python run_pruning.py refined cv.db --target-distance 6.0
```

## Output

The refined approach creates working copies with the prefix `refined_`:
- `cv.db` → `refined_cv.db`
- `tga-pub.db` → `refined_tga-pub.db`

## Algorithm Details

### 1. Spatial Clustering
- Uses DBSCAN to group nodes within target distance
- Calculates cluster centroids and radii
- Selects optimal representatives based on centrality and proximity

### 2. Connectivity Preservation
- Maintains original connectivity between representatives
- Adds strategic edges to connect disconnected components
- Limits new edge distances to 10m to avoid wall penetration

### 3. Coverage Validation
- Generates test grid points throughout the space
- Validates 95% coverage within target distance
- Identifies and reports coverage gaps

### 4. Edge Optimization
- Removes redundant edges while maintaining connectivity
- Uses transitive reduction techniques
- Preserves important alternative paths

## Configuration

Key parameters in `config.py`:
- `outer_ring`: Target clustering distance (default: 5.0m)
- `inner_ring`: Minimum merge distance (default: 0.5m)
- `coords_to_metres`: Coordinate scaling factor (default: 15.0)

## Performance

The advanced approach provides:
- Better node reduction (typically 20-40% more than old approach)
- Maintained or improved coverage scores
- Preserved connectivity
- Efficient processing for large graphs

## Troubleshooting

### Common Issues

1. **Coverage gaps detected**: The algorithm will suggest additional node positions
2. **Connectivity lost**: Check for isolated components in the original graph
3. **Memory issues**: Reduce grid step size in coverage validation

### Verbose Logging
Add `--verbose` flag for detailed logging:
```bash
python run_pruning.py refined cv.db --verbose
```

## Comparison with Old Approach

The refined approach typically achieves:
- 20-40% more node reduction
- Better coverage preservation
- More intelligent handling of parallel branches
- Improved spatial distribution of remaining nodes

## File Structure

```
GraphProcessor/
├── advanced_pruner.py      # Main pruning algorithm
├── spatial_utils.py        # Spatial operations and indexing
├── coverage_validator.py   # Coverage validation and analysis
├── db_manager.py          # Database operations
├── config.py              # Configuration parameters
├── run_pruning.py         # Command-line interface
├── requirements.txt       # Python dependencies
└── README.md             # This file
```


