# CampusVirtual Architecture

This document outlines the high-level architecture of the CampusVirtual system, including component interactions, data flow, and system design.

## System Architecture

```mermaid
graph TB
    subgraph Input
        A[Insta360 Videos] --> B[Video Processing]
        C[Location Data] --> D[Data Processing]
    end

    subgraph Processing
        B --> E[VSLAM Tracking]
        D --> F[Graph Generation]
        E --> F
        F --> G[Graph Optimization]
    end

    subgraph Storage
        G --> H[Database]
        H --> I[Web Interface]
    end

    subgraph Frontend
        I --> J[3D Navigation]
        I --> K[Floorplan Alignment]
        I --> L[Authoring Interface]
    end
```

## Component Interaction

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant VSLAM
    participant GraphProcessor

    User->>Frontend: Request Navigation
    Frontend->>Backend: API Request
    Backend->>Database: Query Data
    Database-->>Backend: Return Graph Data
    Backend-->>Frontend: Send Navigation Data
    Frontend-->>User: Display 3D View

    Note over User,GraphProcessor: Processing Pipeline
    User->>VSLAM: Upload Video
    VSLAM->>GraphProcessor: Process Frames
    GraphProcessor->>Database: Store Graph
```

## Data Flow

```mermaid
flowchart LR
    subgraph Input Layer
        A[Raw Videos]
        B[Location Data]
    end

    subgraph Processing Layer
        C[Video Processing]
        D[VSLAM Tracking]
        E[Graph Generation]
    end

    subgraph Storage Layer
        F[PostgreSQL]
        G[File Storage]
    end

    subgraph Presentation Layer
        H[Web Interface]
        I[3D Navigation]
    end

    A --> C
    B --> E
    C --> D
    D --> E
    E --> F
    E --> G
    F --> H
    G --> H
    H --> I
```

## System Components

### 1. Input Processing
- Video ingestion and processing
- Location data parsing
- Initial data validation

### 2. Core Processing
- VSLAM tracking
- Graph generation
- Path optimization

### 3. Storage
- Database management
- File system organization
- Data persistence

### 4. Presentation
- Web interface
- 3D visualization
- User interaction

## Data Models

### Node Structure
```mermaid
classDiagram
    class Node {
        +int id
        +float x
        +float y
        +float z
        +int type
        +string metadata
    }
```

### Edge Structure
```mermaid
classDiagram
    class Edge {
        +int source
        +int target
        +int type
        +float weight
        +string metadata
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph Client
        A[Web Browser]
    end

    subgraph Server
        B[Node.js Backend]
        C[PostgreSQL]
        D[File Storage]
    end

    subgraph Processing
        E[VSLAM Service]
        F[Graph Processor]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    E --> F
    F --> C
```

## Security Architecture

```mermaid
graph TB
    subgraph Client
        A[User Browser]
    end

    subgraph Security Layer
        B[Authentication]
        C[Authorization]
        D[Rate Limiting]
    end

    subgraph Application
        E[Backend Services]
        F[Database]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## Performance Considerations

1. **Database Optimization**
   - Indexed queries
   - Efficient graph storage
   - Connection pooling

2. **Processing Pipeline**
   - Parallel processing
   - Batch operations
   - Resource management

3. **Frontend Performance**
   - Asset optimization
   - Lazy loading
   - Caching strategies 