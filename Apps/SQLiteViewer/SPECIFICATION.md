# SQLiteViewer Specification

## Overview

The SQLiteViewer is a 3D visualisation tool for exploring and manipulating spatial graph data stored in SQLite databases. It provides an interactive 3D interface for viewing nodes, edges, and other spatial elements, with capabilities for data inspection, editing, and analysis.

## Purpose

The SQLiteViewer serves as a visual debugging and editing tool for spatial mapping data, allowing users to:
- Visualise 3D spatial graphs in an interactive environment
- Inspect node positions, orientations, and relationships
- Edit graph structure by adding/removing nodes and edges
- Analyse spatial proximity and connectivity patterns
- Debug and validate spatial mapping algorithms

## Data Sources

### Primary Tables

#### `nodes` Table
- **Purpose**: Stores the main spatial graph nodes (keyframes)
- **Key Fields**:
  - `keyframe_id` (INTEGER): Unique identifier for the node
  - `x_trans`, `y_trans`, `z_trans` (REAL): 3D position coordinates
  - `pose` (BLOB): 4x4 transformation matrix as binary data
  - `zone` (TEXT, optional): Spatial zone identifier

#### `edges` Table
- **Purpose**: Defines connections between nodes
- **Key Fields**:
  - `keyframe_id0`, `keyframe_id1` (INTEGER): Connected node IDs
  - `type` (INTEGER, optional): Edge type classification
  - `zone` (TEXT, optional): Spatial zone identifier

#### `other_nodes` Table
- **Purpose**: Stores additional spatial points of interest
- **Key Fields**:
  - `id` (INTEGER): Unique identifier
  - `ref_id` (INTEGER): Reference to main node
  - `label` (TEXT): Human-readable label
  - `description` (TEXT): Detailed description
  - `info` (TEXT): Extra information for InfoSpots
  - `image` (TEXT): Optional image name (nullable)
  - `type` (INTEGER): Node type classification
  - `x_trans`, `y_trans`, `z_trans` (REAL): 3D position coordinates

#### `elevator_shafts` Table
- **Purpose**: Associates elevator nodes with their shaft identifiers
- **Key Fields**:
  - `other_node_id` (INTEGER): Primary key, references `other_nodes.id`
  - `shaft_id` (TEXT): Elevator shaft identifier
  - Each `other_node_id` can only belong to one `shaft_id`

## Core Features

### 1. 3D Visualisation

#### Node Rendering
- **Main Nodes**: Rendered as green arrows showing position and orientation
- **Other Nodes**: Rendered as coloured spheres based on type:
  - Normal nodes: Gray
  - Elevator nodes: Red
  - Toilet/Info nodes: Orange
  - Room nodes: Purple
- **Orientation**: Arrows indicate camera/viewing direction using pose matrices

#### Edge Rendering
- **Edge Types**: Colour-coded based on type:
  - Type 0: Blue (default)
  - Type 1: Green
  - Type 2: Orange
  - Type 3: Red (edge contraction)
  - Type -1: Purple (covisibility)
- **Line Weight**: Thicker lines for edge contraction (type 3)
- **Elevator Shafts**: Cyan lines with increased thickness connecting all nodes within the same shaft

#### Interactive Controls
- **Point Picking**: Click to select nodes
- **Camera Controls**: Pan, zoom, rotate in 3D space
- **Axes**: Interactive coordinate system reference

### 2. Data Inspection

#### Node Information
- **Position Display**: 3D coordinates shown on selection
- **ID Lookup**: Keyframe ID identification
- **Type Classification**: Visual distinction of node types

#### Edge Analysis
- **Connectivity**: Visual representation of node relationships
- **Edge Statistics**: Count and type distribution
- **Invalid Edge Detection**: Warning for missing node references

### 3. Spatial Analysis

#### Proximity Search
- **Neighbour Detection**: Find nodes within specified distance
- **Configurable Radius**: Adjustable proximity threshold (default: 1.5/10 units)
- **Visual Highlighting**: Yellow spheres for nearby nodes

#### Distance Calculations
- **3D Euclidean Distance**: Using SQLite custom functions
- **Real-time Query**: Dynamic neighbour detection

### 4. Graph Editing

#### Node Management
- **Node Removal**: Mark nodes for deletion
- **Batch Operations**: Remove multiple nodes simultaneously
- **Cascade Deletion**: Automatic cleanup of related data

#### Edge Management
- **Edge Creation**: Connect two selected nodes
- **Edge Type Assignment**: Specify edge classification
- **Conflict Resolution**: Handle duplicate edges

#### Database Operations
- **Transaction Safety**: Confirmation before destructive operations
- **Atomic Updates**: All-or-nothing database modifications
- **Error Handling**: Graceful failure recovery

### 5. User Interface

#### Keyboard Controls
- **`p`**: Select point (click interaction)
- **`d`**: Mark selected point for removal
- **`1`**: Store first point for edge creation
- **`2`**: Connect stored point to current selection
- **`e`**: Execute pending changes
- **`n`**: Show neighbours of selected point
- **`t`**: Toggle edge visibility

#### Visual Feedback
- **Selection Highlighting**: Visual indication of selected nodes
- **Status Messages**: Console output for user actions
- **Progress Indicators**: Loading progress for large datasets

## Technical Architecture

### Dependencies
- **PyVista**: 3D visualisation and rendering
- **NumPy**: Numerical computations and matrix operations
- **SQLite3**: Database connectivity and querying
- **tqdm**: Progress bar visualisation

### Data Flow
1. **Database Connection**: Establish SQLite connection
2. **Data Loading**: Query and parse spatial data
3. **3D Mapping**: Convert coordinates to 3D positions
4. **Rendering**: Create visual representations
5. **Interaction**: Handle user input and selections
6. **Updates**: Modify database based on user actions

### Performance Considerations
- **Lazy Loading**: Load data on demand
- **Batch Operations**: Group database updates
- **Memory Management**: Efficient data structures
- **Progress Tracking**: User feedback for long operations

## Configuration

### Global Settings
- **`proximity`**: Neighbour detection radius (1.5/10 units)
- **`SHOW_EDGES`**: Toggle edge rendering (True/False)
- **Edge Type Constants**: Predefined edge type values

### Database Schema Compatibility
- **Flexible Schema**: Handles different table structures
- **Column Detection**: Automatic detection of available fields
- **Fallback Support**: Graceful degradation for missing tables

## Error Handling

### Database Errors
- **Connection Failures**: Graceful connection management
- **Query Errors**: Informative error messages
- **Transaction Rollback**: Safe failure recovery

### Data Validation
- **Node Existence**: Verify node references before operations
- **Edge Validity**: Check for valid node connections
- **Type Safety**: Validate data types and ranges

## Use Cases

### Development and Debugging
- **Algorithm Validation**: Verify spatial mapping results
- **Data Quality**: Inspect and clean spatial data
- **Performance Analysis**: Visualise graph structure efficiency

### Data Management
- **Graph Editing**: Modify spatial relationships
- **Node Cleanup**: Remove unwanted or invalid nodes
- **Edge Optimisation**: Improve graph connectivity

### Visualisation and Analysis
- **Spatial Understanding**: Comprehend 3D spatial relationships
- **Pattern Recognition**: Identify spatial patterns and anomalies
- **Documentation**: Create visual documentation of spatial data

## Future Enhancements

### Potential Features
- **Export Capabilities**: Save visualisations as images/videos
- **Advanced Filtering**: Filter nodes/edges by various criteria
- **Measurement Tools**: Distance and angle measurements
- **Animation**: Animate through time-based data
- **Collaborative Editing**: Multi-user editing capabilities

### Performance Improvements
- **Level of Detail**: Adaptive rendering for large datasets
- **Spatial Indexing**: Optimised spatial queries
- **Caching**: Intelligent data caching strategies
- **Parallel Processing**: Multi-threaded data loading

## Dependencies and Requirements

### System Requirements
- **Python 3.7+**: Modern Python version
- **OpenGL**: Hardware-accelerated rendering
- **SQLite 3**: Database engine

### Python Packages
- `pyvista>=0.40.0`: 3D visualisation
- `numpy>=1.20.0`: Numerical computing
- `tqdm>=4.60.0`: Progress bars

### Hardware Recommendations
- **GPU**: Dedicated graphics card for smooth 3D rendering
- **RAM**: 8GB+ for large datasets
- **Storage**: SSD for database performance


