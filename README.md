![Sitexplorer: Large-scale Low-cost Panoramic Virtual Tours](logo/SitexplorerLogo.png)

# Sitexplorer

A comprehensive system for creating and managing large-scale panoramic virtual tours. The system processes equirectangular videos (stitched from Insta360 INSV files), tracks camera movement using VSLAM, and creates an interactive 3D navigation experience.

## Quick Start

1. Clone the repository recursively:
   ```bash
   git clone --recursive https://github.com/Skwangles/Sitexplorer.git
   ```
   > **Important**: The `--recursive` flag is required as the project uses submodules. Some submodules are private and may need to be cloned manually.

2. Set up the environment:
   ```bash
   source SOURCE_SETUP.sh
   cp .env.example .env  # Update with your configuration
   ```

3. Build and run:
   ```bash
   ./RUNME.sh  # This runs BUILD_LIBS.sh and BUILD_CAMPUSVIRTUAL.sh
   ```

## System Overview

### Video Processing Pipeline

1. **Video Input**: Equirectangular videos (stitched from Insta360 INSV files)
2. **Location Data**: JSON files describing points of interest and building/floor transitions
3. **VSLAM Processing**: Tracks camera path and builds XYZ graph
4. **Database Conversion**: Converts VSLAM SQLite3 maps to custom Campus Virtual DB format
5. **Graph Optimization**: Pruning and merging of navigation graphs
6. **Web Interface**: Interactive 3D navigation using React and THREE.js

### Key Features

- **Video Processing**: Insta360 SDK integration for video stitching
- **VSLAM Tracking**: Modified Stella VSLAM for accurate pose tracking
- **Graph Management**: Custom node/edge structure for navigation
- **Interactive UI**: 3D visualization with floorplan alignment
- **Environment Management**: Flexible configuration system

## Required Libraries

- **Docker**: [https://www.docker.com/get-started/](https://www.docker.com/get-started/) - For PostgreSQL database
- **Stella VSLAM**: [https://github.com/Skwangles/stella_vslam.git](https://github.com/Skwangles/stella_vslam.git) - Forked version for pose tracking
- **Insta360 SDK**: Required for video processing (apply at [https://www.insta360.com/sdk/apply](https://www.insta360.com/sdk/apply))

### Automatically Installed by BUILD_LIBS.sh

- OpenCV
- Stella VSLAM
- g2o
- Stella VSlam custom FBoW implementation
- Iridescence
- Node.js

## Usage Guide

### Basic Usage

1. **Environment Setup**:
   ```bash
   source SOURCE_SETUP.sh
   ```

2. **Configuration**:
   - Copy `.env.example` to `.env`
   - Update configuration values
   - Enable/disable features as needed

3. **Building**:
   ```bash
   ./RUNME.sh  # Runs BUILD_LIBS.sh and BUILD_CAMPUSVIRTUAL.sh
   ```

### Advanced Usage

The system provides several scripts for different operations:

- `bin/scripts/cv_run_X.sh`: Various processing scripts
- `bin/scripts/cv_merge.sh`: Map merging
- `bin/scripts/cv_prune.sh`: Graph pruning
- `bin/scripts/cv_export.sh`: Database export

For examples of complex operations, see the `/examples` directory.

## Database Structure

### Nodes

Nodes represent points in 3D space with different types:
- Type 0: Normal image points
- Type 1: Elevator points
- Type 2+: Special points (e.g., merge points)

### Edges

Edges connect nodes and define navigable paths:
- Type -1: Covisibility edges (shared landmarks)
- Type 0: Normal navigation edges
- Type 1: Loop closure edges
- Type 2: Merge point edges
- Type 3: Edge contraction edges
- Type 4: Pathfind-only edges

## Environment Management

The system uses a flexible environment configuration system:

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

## Optional Features

### Face Blurring

For privacy concerns, consider using [blur360](https://github.com/thaytan/blur360) for face blurring in 360-degree images.

### Authoring Interface

The authoring interface (`<url>/authoring`) allows:
- Aligning points to 2D floorplans
- Editing node positions
- Managing floorplan images
- Configuring navigation paths

> **Note**: The authoring interface should only be enabled for admin use.

## Troubleshooting

### Common Issues

1. **Submodule Issues**:
   - Ensure all submodules are cloned
   - Check for private repository access

2. **Build Failures**:
   - Verify all dependencies are installed
   - Check system requirements

3. **Database Issues**:
   - Ensure PostgreSQL is running
   - Check database permissions

### Performance Tuning

- Adjust `coords_to_metres` in `sitexplorer-backend/ui/src/consts.ts` for better point spacing
- Configure graph pruning parameters for optimal navigation
- Tune VSLAM parameters for better tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[License](LICENSE)

## Contact

hi@skwangles.com
