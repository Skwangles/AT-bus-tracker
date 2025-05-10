# Campus Virtual Documentation

Welcome to the Campus Virtual documentation. This documentation provides comprehensive information about the Campus Virtual system, its components, and how to use them.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Components](#components)
4. [Getting Started](#getting-started)
5. [Development Guide](#development-guide)
6. [API Documentation](#api-documentation)

## Overview

Campus Virtual is a comprehensive system for managing and visualizing campus environments. The system consists of multiple components that work together to provide a complete solution for campus management and visualization.

## System Architecture

The system is built as a monorepo containing multiple applications and services:

- Frontend applications
- Backend services
- Processing tools
- Utility applications

## Components

### Core Applications

- **CampusVirtual-FileProcessing**: Handles file processing and management
- **blur360-images**: Image processing and 360-degree image handling
- **authoring-backend**: Backend service for content authoring
- **campusvirtual-backend**: Main backend service

### Utility Tools

- **ImageSplitter**: Tool for splitting images
- **MapMerge**: Tool for merging map data
- **GraphPruner**: Tool for graph data processing
- **SharpnessCalculator**: Tool for calculating image sharpness
- **SLAM**: Simultaneous Localization and Mapping tools

## Getting Started

### Prerequisites

- Node.js
- Docker
- Required system dependencies

### Installation

1. Clone the repository
2. Run `SOURCE_SETUP.sh` to set up the development environment
3. Run `BUILD_LIBS.sh` to build the required libraries
4. Run `BUILD_CAMPUS_VIRTUAL.sh` to build the main application

### Running the System

1. Start the required services using `START_SERVERS.sh`
2. Run the main application using `RUNME.sh`

## Development Guide

### Project Structure

```
CampusVirtual/
├── Apps/                    # Application components
├── Config/                  # Configuration files
├── libs/                    # Shared libraries
├── ENTRYPOINT/             # Entry points
└── examples/               # Example code and usage
```

### Development Workflow

1. Set up your development environment
2. Make changes in the appropriate component
3. Test your changes
4. Submit a pull request

## API Documentation

Detailed API documentation for each component will be available in their respective sections.

---

For more detailed information about specific components, please refer to their individual documentation pages. 