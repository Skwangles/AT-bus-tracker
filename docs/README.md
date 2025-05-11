# Campus Virtual Documentation

Welcome to the Campus Virtual documentation. This documentation provides comprehensive information about the Campus Virtual system, its components, and how to use them.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Components](#components)
4. [Getting Started](#getting-started)
5. [Development Guide](#development-guide)
6. [Database Documentation](#database-documentation)
7. [Environment Management](#environment-management)

## Overview

Campus Virtual is a comprehensive system for creating and managing large-scale panoramic virtual tours. The system processes equirectangular videos (stitched from Insta360 INSV files), tracks camera movement using VSLAM, and creates an interactive 3D navigation experience.

## System Architecture

The system is built as a monorepo containing multiple components that work together:

1. **Video Processing Pipeline**
   - Insta360 video stitching
   - VSLAM tracking and mapping
   - Graph construction and optimization

2. **Database Layer**
   - SQLite3 for VSLAM maps
   - PostgreSQL for final graph storage
   - Custom node/edge structure for navigation

3. **Web Interface**
   - React frontend with THREE.js visualization
   - Authoring interface for map alignment
   - Interactive navigation system

## Components

### Core Applications

- **CampusVirtual-FileProcessing**: Interface for Insta360 SDK and image processing
- **SLAM**: Modified Stella VSLAM implementation for pose tracking
- **RunCampusVirtual**: C++ interface for VSLAM operations
- **campusvirtual-backend**: React frontend for visualization and navigation
- **authoring-backend**: Admin interface for map editing and floorplan alignment

### Utility Tools

- **ImageSplitter**: Extracts used images from the database
- **MapMerger**: Merges multiple maps using Procrustes Analysis
- **GraphPruner**: Optimizes the navigation graph
- **SharpnessCalculator**: Preprocesses image sharpness for optimization

## Getting Started

### Prerequisites

- Docker (for PostgreSQL)
- Insta360 SDK (for video processing)
- Node.js
- Required system libraries (installed by BUILD_LIBS.sh)

### Installation

1. Clone the repository recursively:
   ```bash
   git clone --recursive https://github.com/Skwangles/CampusVirtual.git
   ```

2. Set up the environment:
   ```bash
   source SOURCE_SETUP.sh
   cp .env.example .env  # Update with your configuration
   ```

3. Build the system:
   ```bash
   ./RUNME.sh  # This runs BUILD_LIBS.sh and BUILD_CAMPUSVIRTUAL.sh
   ```

### Running the System

1. Process videos and create maps:
   ```bash
   ./bin/scripts/cv_run_X.sh  # Various processing scripts
   ```

2. Start the web interface:
   ```bash
   ./RUNME.sh  # With appropriate profile
   ```

## Development Guide

### Project Structure

```
CampusVirtual/
├── Apps/                    # Application components
├── Config/                  # Configuration files
├── libs/                    # Shared libraries
├── ENTRYPOINT/             # Entry points
├── examples/               # Example configurations
└── docs/                   # Documentation
```

### Environment Management

The system uses a flexible environment management system:
- Base configuration in `.env`
- Profile-specific settings in JSON files
- Secret management through `.env.secrets`
- Project-specific configurations

See [Environment Management](#environment-management) for details.

## Database Documentation

The system uses multiple database types:
- VSLAM SQLite3 maps
- PostgreSQL for final graph storage
- Custom node/edge structure

See [Database Structure](database/structure.md) for detailed schema information.

## Environment Management

The system provides a flexible environment configuration system:

1. **Base Environment** (`.env`)
   - Common configuration variables
   - Loaded first into shell environment

2. **Profile Configuration** (e.g., `development.json`)
   - Environment-specific settings
   - Supports variable interpolation

3. **Secret Management** (`.env.secrets`)
   - Sensitive configuration data
   - Not written to files

4. **Project-Specific Secrets**
   - Per-project secret configurations
   - Loaded at runtime

For more details on environment configuration, see the main README.md.

---

For more detailed information about specific components, please refer to their individual documentation pages. 