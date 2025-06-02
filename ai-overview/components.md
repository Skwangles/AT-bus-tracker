# CampusVirtual Components

This document provides a detailed overview of the key components that make up the CampusVirtual system.

## Core Components

### 1. Video Processing Pipeline

#### Insta360 Integration
- Handles raw Insta360 INSV files
- Performs video stitching
- Generates equirectangular output

#### Video Processing
- Frame extraction
- Quality assessment
- Metadata extraction

### 2. VSLAM System

#### Stella VSLAM Integration
- Camera pose tracking
- Feature detection and matching
- Map building

#### Graph Generation
- Node creation from keyframes
- Edge generation for navigation
- Loop closure detection

### 3. Graph Management

#### Graph Structure
- Node types:
  - Type 0: Normal image points
  - Type 1: Elevator points
  - Type 2+: Special points (merge points)

- Edge types:
  - Type -1: Covisibility edges
  - Type 0: Normal navigation edges
  - Type 1: Loop closure edges
  - Type 2: Merge point edges
  - Type 3: Edge contraction edges
  - Type 4: Pathfind-only edges

#### Graph Optimization
- Path pruning
- Node merging
- Graph simplification

### 4. Database System

#### PostgreSQL Integration
- Graph data storage
- User management
- Configuration storage

#### Data Models
- Node storage
- Edge relationships
- Metadata management

### 5. Web Interface

#### Frontend Components
- React-based UI
- THREE.js visualization
- Interactive controls

#### Backend Services
- Node.js API
- WebSocket support
- File serving

## Supporting Components

### 1. Authoring Tools

#### Floorplan Alignment
- 2D floorplan integration
- Point alignment tools
- Navigation path editing

#### Content Management
- Media organization
- Metadata editing
- Access control

### 2. Processing Tools

#### Map Merge
- Multiple map integration
- Conflict resolution
- Graph optimization

#### Graph Pruner
- Redundant node removal
- Path optimization
- Performance improvement

### 3. Utility Components

#### Image Processing
- Sharpness calculation
- Image splitting
- Face blurring

#### Data Export
- Database conversion
- Format transformation
- Backup generation

## Component Interactions

### Data Flow
1. Video input → Processing pipeline
2. Processed frames → VSLAM system
3. VSLAM output → Graph generation
4. Graph data → Database storage
5. Stored data → Web interface

### Control Flow
1. User input → Web interface
2. Interface requests → Backend services
3. Service processing → Database queries
4. Query results → Frontend rendering

## Component Dependencies

### Required Libraries
- OpenCV
- Stella VSLAM
- g2o
- Node.js
- React
- THREE.js
- PostgreSQL

### External Services
- Insta360 SDK
- Docker
- Web servers

## Component Configuration

### Environment Setup
- Base configuration
- Profile-specific settings
- Secret management

### Performance Tuning
- VSLAM parameters
- Graph optimization settings
- Database configuration

## Development Guidelines

### Component Development
1. Follow established patterns
2. Maintain documentation
3. Include unit tests
4. Consider performance impact

### Integration Guidelines
1. Use defined interfaces
2. Handle errors gracefully
3. Maintain backward compatibility
4. Document changes

## Maintenance Considerations

### Monitoring
- Performance metrics
- Error tracking
- Resource usage

### Updates
- Version control
- Dependency management
- Security patches

### Backup
- Database backups
- Configuration backups
- Media storage 