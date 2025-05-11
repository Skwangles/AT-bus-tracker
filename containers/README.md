# Campus Virtual Microservices Architecture

This repository contains the containerized microservices for the Campus Virtual system. The architecture consists of five main services: Model Generation, Map Processing, Blurring, Authoring, and Frontend, each running in its own container.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Model          │     │  Map            │     │  Blurring       │
│  Generation     │────▶│  Processing     │────▶│  Service        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Authoring      │◀────│  Frontend       │     │  Control        │
│  Service        │     │  Dashboard      │     │  Dashboard      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Services

### 1. Model Generation Service
- **Port**: 5000
- **Purpose**: Handles the generation of 3D models from input data
- **Input/Output**: 
  - Input: Raw model data
  - Output: Generated 3D models
- **Environment Variables**:
  - `MODEL_INPUT_DIR`: Input directory path
  - `MODEL_OUTPUT_DIR`: Output directory path

### 2. Map Processing Service
- **Port**: 5001
- **Purpose**: Processes and generates maps from model data
- **Input/Output**:
  - Input: 3D model data
  - Output: Processed maps
- **Environment Variables**:
  - `MAP_INPUT_DIR`: Input directory path
  - `MAP_OUTPUT_DIR`: Output directory path

### 3. Blurring Service
- **Port**: 5002
- **Purpose**: Handles image blurring and privacy protection
- **Input/Output**:
  - Input: Images requiring blurring
  - Output: Blurred images
- **Environment Variables**:
  - `BLUR_INPUT_DIR`: Input directory path
  - `BLUR_OUTPUT_DIR`: Output directory path

### 4. Authoring Service
- **Port**: 5003
- **Purpose**: Manages content authoring and editing
- **Input/Output**:
  - Input: Raw content
  - Output: Processed content
- **Environment Variables**:
  - `AUTHOR_INPUT_DIR`: Input directory path
  - `AUTHOR_OUTPUT_DIR`: Output directory path

### 5. Frontend Dashboard
- **Port**: 3000
- **Purpose**: Web interface for controlling and monitoring services
- **Environment Variables**:
  - `REACT_APP_API_URL`: Backend API URL

## Setup and Installation

### Prerequisites
- Docker
- Docker Compose
- Git

### Installation Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd containers
```

2. Create required directories:
```bash
mkdir -p model-generation/input model-generation/output
mkdir -p map-processing/input map-processing/output
mkdir -p blurring/input blurring/output
mkdir -p authoring/input authoring/output
```

3. Build and start the containers:
```bash
docker-compose up --build
```

## Directory Structure

```
containers/
├── model-generation/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── input/
│   └── output/
├── map-processing/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── input/
│   └── output/
├── blurring/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── input/
│   └── output/
├── authoring/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── input/
│   └── output/
├── frontend/
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
└── README.md
```

## Usage

### Starting Services
```bash
docker-compose up
```

### Stopping Services
```bash
docker-compose down
```

### Viewing Logs
```bash
docker-compose logs -f [service-name]
```

### Accessing Services
- Frontend Dashboard: http://localhost:3000
- Model Generation API: http://localhost:5000
- Map Processing API: http://localhost:5001
- Blurring API: http://localhost:5002
- Authoring API: http://localhost:5003

## Data Flow

1. **Model Generation**:
   - Receives raw input data
   - Generates 3D models
   - Outputs to shared volume

2. **Map Processing**:
   - Reads model data from shared volume
   - Processes and generates maps
   - Outputs to shared volume

3. **Blurring**:
   - Reads images from shared volume
   - Applies blurring algorithms
   - Outputs processed images

4. **Authoring**:
   - Reads processed content
   - Allows content editing
   - Outputs final content

## Volumes

The system uses Docker volumes for persistent data storage:
- `model_input`: Input data for model generation
- `model_output`: Generated model data
- `map_input`: Input data for map processing
- `map_output`: Processed map data
- `blur_input`: Input images for blurring
- `blur_output`: Blurred images
- `author_input`: Input content for authoring
- `author_output`: Processed content

## Network

All services are connected through a bridge network named `cv_network`, allowing inter-service communication while maintaining isolation.

## Development

### Adding New Dependencies
1. Add dependencies to the respective `requirements.txt` file
2. Rebuild the container:
```bash
docker-compose build [service-name]
```

### Modifying Service Code
1. Make changes to the service code
2. Rebuild and restart the service:
```bash
docker-compose up -d --build [service-name]
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Ensure no other services are using the required ports
   - Modify port mappings in docker-compose.yml if needed

2. **Volume Permissions**
   - Check volume permissions if services can't access data
   - Ensure proper ownership of mounted directories

3. **Service Communication**
   - Verify network connectivity between services
   - Check service logs for connection errors

### Logs and Debugging

View service logs:
```bash
docker-compose logs -f [service-name]
```

Access service shell:
```bash
docker-compose exec [service-name] /bin/bash
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Specify your license here] 