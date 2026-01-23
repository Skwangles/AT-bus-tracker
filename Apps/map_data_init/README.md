# Map Data Initialization (Python)

This module initializes the database with floorplan data, creating tables and populating them with node locations and floorplan points.

## Overview

The map data initialization module handles:
- Creating `floorplan_images` and `floorplan_points` tables
- Processing node locations and coordinates
- Handling staircase connections between floors
- Clustering border nodes to reduce redundancy
- Normalizing coordinates to percentage-based map positions

## Features

### Database Tables
- **`floorplan_images`**: Stores location-to-image path mappings
- **`floorplan_points`**: Stores normalized coordinates for floorplan visualization

### Node Processing
- **Floor Nodes**: Nodes within the current location
- **Border Nodes**: Nodes in adjacent locations connected via edges
- **Staircase Nodes**: Special handling for multi-floor connections

### Coordinate Normalization
- Converts raw XYZ coordinates to percentage-based positions (0-1)
- Maintains aspect ratio and spatial relationships
- Handles edge cases with proper clamping

## Installation

No external dependencies required - uses only Python standard library:

```bash
# Clone the repository
cd Apps/map_data_init

# The module is ready to use
```

## Usage

### Command Line Interface

```bash
# Basic usage
python main.py --db-path /path/to/database.db

# With custom log level
python main.py --db-path /path/to/database.db --log-level DEBUG

# Skip if tables already exist
python main.py --db-path /path/to/database.db --quit-if-exists
```

### Programmatic Usage

```python
from initData import initDB
from db import connect_db, close_db

# Connect to database
connect_db("/path/to/database.db")

# Initialize map data
await initDB(quit_if_tables_exist=False)

# Close connection
close_db()
```

## Environment Variables

### Required Variables
- `SX_HOME_DIR` - Root directory of the Sitexplorer project

### Optional Variables
- `SX_DB_DIR` - Directory containing SQLite database files (default: `"/Maps/"`)
- `SX_INIT_DB_NAME` - Name of the database to initialize (default: `"campus.db"`)
- `SX_INIT_DONT_OVERWRITE_MAP_POINTS` - Skip if map already configured (default: `false`, set to `"true"` to enable)

## Scripts

### `bin/scripts/sx_run_9_init_data.sh`
Initializes map data in the database:
- Builds the TypeScript project
- Runs the initialization script
- Creates floorplan_images and floorplan_points tables

**Usage:**
```bash
./bin/scripts/sx_run_9_init_data.sh
```

**Environment Variables:**
- Uses `SX_HOME_DIR`, `SX_DB_DIR`, `SX_INIT_DB_NAME`
- Optional: `SX_INIT_DONT_OVERWRITE_MAP_POINTS`

## Pipeline Position

The Map Data Initialization runs **after** the following steps:
- `sx_run_1_process_files.sh` - File processing
- `sx_run_2_map.sh` - VSLAM mapping
- `sx_run_4_export_sqlite.sh` - Database export
- `sx_run_6_prune_graph.sh` - Graph pruning (optional)

**Before:**
- Database must be exported and contain nodes, edges, and node_locations tables

**After:**
- Floorplan data ready for authoring system
- `sx_run_10_start_authoring.sh` - Start authoring system

## Configuration

### Environment Variables (Legacy)

Legacy `USE_TABLE_PREFIX`/`TABLE_PREFIX` options have been removed. The initializer now writes directly to the canonical tables used by the rest of the pipeline.

### Constants

Key constants in `consts.py`:

```python
# Floor point types
FLOOR_POINT_DEFAULT_TYPE = 0
BORDERING_FLOOR_POINT_DEFAULT_TYPE = 1

# String size limits
REASONABLE_MAX_STRING_SIZE = 255
```

## Architecture

### Core Functions

1. **`initDB()`**: Main initialization function
2. **`get_floor_nodes()`**: Retrieves nodes within a location
3. **`get_border_nodes()`**: Retrieves connected nodes in adjacent locations
4. **`process_staircase_nodes()`**: Handles multi-floor connections
5. **`cluster_border_nodes()`**: Reduces redundancy in border nodes

### Data Flow

```
Input: Database with nodes, edges, node_locations
  ↓
Process: Extract locations and node relationships
  ↓
Transform: Normalize coordinates and handle special cases
  ↓
Output: floorplan_images and floorplan_points tables
```

## Database Schema

### floorplan_images
```sql
CREATE TABLE floorplan_images (
    location TEXT PRIMARY KEY,
    path TEXT DEFAULT ''
);
```

### floorplan_points
```sql
CREATE TABLE floorplan_points (
    location TEXT NOT NULL,
    x DOUBLE PRECISION DEFAULT 0 NOT NULL,
    y DOUBLE PRECISION DEFAULT 0 NOT NULL,
    keyframe_id INTEGER REFERENCES nodes(keyframe_id) ON DELETE CASCADE,
    type INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (keyframe_id, location)
);
```

## Error Handling

The module includes comprehensive error handling:
- **Database Connection**: Graceful connection failures
- **Query Execution**: Rollback on failed transactions
- **Data Validation**: Input parameter validation
- **Staircase Processing**: Fallback to original nodes on errors

## Logging

Configurable logging levels:
- **DEBUG**: Detailed execution information
- **INFO**: General progress information
- **WARNING**: Non-critical issues
- **ERROR**: Critical failures

## Migration from TypeScript

This Python version maintains feature parity with the original TypeScript implementation:

- ✅ **Async/await**: Full async support
- ✅ **Type hints**: Comprehensive type annotations
- ✅ **Error handling**: Robust exception handling
- ✅ **Logging**: Structured logging system
- ✅ **Database operations**: SQLite with connection management
- ✅ **Command line interface**: CLI with argument parsing

## Performance Considerations

- **Batch Processing**: Processes locations sequentially to avoid memory overload
- **Connection Pooling**: Single database connection per session
- **Transaction Management**: Uses database transactions for atomicity
- **Memory Efficiency**: Processes data in chunks rather than loading all at once

## Troubleshooting

### Common Issues

1. **Database Connection Failed**: Check file path and permissions
2. **Tables Already Exist**: Use `--quit-if-exists` flag
3. **Permission Denied**: Ensure write access to database directory
4. **Invalid Coordinates**: Check node data integrity

### Debug Mode

Enable debug logging for detailed execution information:

```bash
python main.py --db-path database.db --log-level DEBUG
```

