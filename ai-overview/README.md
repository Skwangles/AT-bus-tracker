# CampusVirtual - Architectural Documentation

This documentation provides a comprehensive overview of the CampusVirtual system architecture, components, and their interactions. CampusVirtual is a sophisticated system for creating and managing large-scale panoramic virtual tours, featuring advanced video processing, VSLAM tracking, and interactive 3D navigation.

## Documentation Structure

- [Architecture](architecture.md) - System architecture diagrams and explanations
- [Components](components.md) - Detailed overview of system components

## System Overview

CampusVirtual is designed to process equirectangular videos (stitched from Insta360 INSV files), track camera movement using VSLAM, and create an interactive 3D navigation experience. The system is built with scalability and performance in mind, supporting large-scale virtual tours with complex navigation paths.

### Key System Capabilities

1. **Video Processing**
   - Insta360 video stitching
   - Equirectangular video processing
   - Face blurring for privacy

2. **Spatial Tracking**
   - VSLAM-based camera pose tracking
   - Graph-based navigation structure
   - Multi-floor support

3. **Interactive Navigation**
   - 3D visualization
   - Floorplan alignment
   - Custom navigation paths

4. **Data Management**
   - Custom database format
   - Graph optimization
   - Map merging capabilities

## Technology Stack

- **Backend**: Node.js, PostgreSQL
- **Frontend**: React, THREE.js
- **Computer Vision**: OpenCV, Stella VSLAM
- **Processing**: Custom C++ applications
- **Containerization**: Docker

## Development Guidelines

When working with the CampusVirtual system, consider the following:

1. **Performance**
   - Optimize VSLAM parameters for tracking accuracy
   - Configure graph pruning for efficient navigation
   - Monitor database performance

2. **Scalability**
   - Design for large-scale deployments
   - Consider memory usage in video processing
   - Optimize database queries

3. **Maintainability**
   - Follow established coding standards
   - Document new features
   - Update tests with changes

## Getting Started

For detailed setup instructions and development guidelines, refer to the main project [README](../README.md). 