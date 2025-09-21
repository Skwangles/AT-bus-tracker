# Sitexplorer Architecture Documentation

## System Overview

Sitexplorer is a comprehensive system for creating large-scale panoramic virtual tours. The architecture combines computer vision, spatial computing, and web technologies to transform 360° video recordings into interactive virtual experiences.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Data Input Layer"
        A[360° Videos<br/>INSV Files] --> B[Video Processing<br/>Insta360 SDK]
        C[Location Metadata<br/>JSON Files] --> B
        D[Floorplan Images<br/>PNG/JPG] --> B
    end
    
    subgraph "Core Processing Layer"
        B --> E[VSLAM Processing<br/>Stella VSLAM]
        E --> F[Database Conversion<br/>SQLite]
        F --> G[Graph Optimization<br/>Python]
        G --> H[Data Initialization<br/>TypeScript]
    end
    
    subgraph "Application Layer"
        H --> I[Authoring System<br/>React + Node.js]
        H --> J[Viewer Interface<br/>THREE.js]
        H --> K[API Services<br/>Express.js]
    end
    
    subgraph "Storage Layer"
        L[SQLite Database] --> F
        L --> G
        L --> H
        M[File System<br/>Images & Videos] --> I
        M --> J
        N[Cloud Storage<br/>R2/CDN] --> J
    end
    
    style A fill:#e1f5fe
    style I fill:#c8e6c9
    style J fill:#c8e6c9
    style L fill:#fff3e0
```

## Component Architecture

### 1. VSLAM Processing Pipeline

```mermaid
graph TB
    subgraph "VSLAM System"
        A[Video Input] --> B[Frame Extraction]
        B --> C[Feature Detection<br/>ORB Features]
        C --> D[Pose Estimation<br/>PnP Solver]
        D --> E[Map Building<br/>Keyframe Management]
        E --> F[Loop Closure<br/>Place Recognition]
        F --> G[Bundle Adjustment<br/>Graph Optimization]
        G --> H[Database Export<br/>SQLite]
    end
    
    subgraph "Configuration"
        I[Camera Config<br/>indoors.yaml] --> C
        J[Vocabulary<br/>orb_vocab.fbow] --> C
        K[Location Metadata<br/>JSON] --> E
    end
    
    style A fill:#e1f5fe
    style H fill:#c8e6c9
```

**Key Components**:
- **`cv_map`**: Main mapping tool for video processing
- **`cv_view_map`**: Static map viewer for inspection
- **`cv_slam_to_sqlite`**: Converts VSLAM maps to SQLite format

### 2. Graph Processing Architecture

```mermaid
graph TB
    subgraph "Graph Processing"
        A[SQLite Database] --> B[Database Manager<br/>Python]
        B --> C[Grid-Based Pruner<br/>Spatial Partitioning]
        C --> D[Sharpness Calculator<br/>Image Quality]
        D --> E[Reference Redirection<br/>Data Integrity]
        E --> F[Edge Mapping<br/>Connectivity]
        F --> G[Connectivity Validation<br/>Graph Analysis]
        G --> H[Optimized Database<br/>SQLite]
    end
    
    subgraph "Configuration"
        I[Grid Size<br/>5x5x5m] --> C
        J[Sharpness Data<br/>JSON] --> D
        K[Coordinate Scaling<br/>coords_to_metres] --> C
    end
    
    style A fill:#e1f5fe
    style H fill:#c8e6c9
```

**Algorithm Details**:
1. **Spatial Partitioning**: Nodes partitioned into 5x5x5m grid boxes
2. **Representative Selection**: Sharpest node selected per grid box
3. **Reference Redirection**: All references redirected to representatives
4. **Edge Mapping**: Edges redirected to representative nodes
5. **Connectivity Validation**: Ensures graph remains connected

### 3. Authoring System Architecture

```mermaid
graph TB
    subgraph "Frontend (React)"
        A[App.tsx<br/>Main Shell] --> B[LocationGroupSelector<br/>Location Management]
        A --> C[FloorplanEditor<br/>Spatial Editing]
        C --> D[PointManager<br/>Node Operations]
        C --> E[ImageUploader<br/>File Management]
        C --> F[Legend<br/>UI Helpers]
    end
    
    subgraph "Backend (Node.js)"
        G[Express Server<br/>REST API] --> H[Points Controller<br/>CRUD Operations]
        G --> I[Image Controller<br/>File Handling]
        G --> J[Labels Controller<br/>Metadata Management]
        G --> K[Editing Controller<br/>Spatial Operations]
        G --> L[Map Controller<br/>Floorplan Management]
    end
    
    subgraph "Database Layer"
        M[SQLite Database] --> N[nodes table<br/>Spatial Graph]
        M --> O[other_nodes table<br/>Points of Interest]
        M --> P[floorplan_points table<br/>2D Projections]
        M --> Q[floorplan_images table<br/>Image Metadata]
    end
    
    A --> G
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    
    style A fill:#e1f5fe
    style G fill:#f3e5f5
    style M fill:#c8e6c9
```

## Data Flow Architecture

### Processing Pipeline

```mermaid
flowchart LR
    A[Raw Videos<br/>INSV Files] --> B[Video Stitching<br/>Insta360 SDK]
    B --> C[VSLAM Processing<br/>Pose Tracking]
    C --> D[Database Conversion<br/>SQLite Maps]
    D --> E[Sharpness Calculation<br/>Image Quality]
    E --> F[Graph Pruning<br/>Spatial Optimization]
    F --> G[Map Merging<br/>Multi-Session]
    G --> H[Data Initialization<br/>Floorplan Mapping]
    H --> I[Authoring Interface<br/>Web Editing]
    I --> J[Content Stripping<br/>Privacy Protection]
    J --> K[Image Extraction<br/>Asset Management]
    K --> L[Final Export<br/>Client Delivery]
    
    style A fill:#e1f5fe
    style L fill:#c8e6c9
```

### Database Schema Architecture

```mermaid
erDiagram
    NODES ||--o{ EDGES : connects
    NODES ||--o{ OTHER_NODES : references
    NODES ||--o{ NODE_LOCATIONS : located_in
    NODES ||--o{ FLOORPLAN_POINTS : projects_to
    NODES ||--o{ USER_DEFINED_LABELS : labeled_as
    
    NODES {
        real ts PK "Timestamp"
        int keyframe_id PK "Unique identifier"
        blob pose "4x4 transformation matrix"
        real x_trans "X coordinate"
        real y_trans "Y coordinate"
        real z_trans "Z coordinate"
        text zone "Spatial zone identifier"
    }
    
    EDGES {
        int keyframe_id0 FK "Source node"
        int keyframe_id1 FK "Target node"
        int type "Edge type classification"
        text zone "Spatial zone identifier"
    }
    
    OTHER_NODES {
        int id PK "Unique identifier"
        int ref_id FK "Reference to main node"
        text label "Human-readable label"
        text description "Detailed description"
        int type "Node type classification"
        real x_trans "X coordinate"
        real y_trans "Y coordinate"
        real z_trans "Z coordinate"
    }
    
    NODE_LOCATIONS {
        int keyframe_id FK "Reference to node"
        text location "Location identifier"
        text zone "Spatial zone identifier"
    }
    
    FLOORPLAN_POINTS {
        text location FK "Location identifier"
        real x "2D X coordinate"
        real y "2D Y coordinate"
        int keyframe_id FK "Reference to node"
        int type "Point type classification"
    }
    
    FLOORPLAN_IMAGES {
        text location PK "Location identifier"
        text path "Image file path"
    }
```

## Configuration Architecture

### Multi-Layer Configuration System

```mermaid
graph TB
    subgraph "Configuration Layers"
        A["Base Environment<br/>.env"] --> B["Profile Configuration<br/>configs/*.json"]
        B --> C["Secret Management<br/>.env.secrets"]
        C --> D["Project Secrets<br/>Apps/*/.env.secrets"]
    end
    
    subgraph "Configuration Processing"
        E["Environment Manager<br/>env_manager.sh"] --> F["JSON Validation<br/>jq"]
        F --> G["Variable Interpolation<br/>VAR substitution"]
        G --> H["Array Processing<br/>JSON to Bash"]
        H --> I["Node.js Integration<br/>Environment copying"]
    end
    
    subgraph "Feature Flags"
        J["Pipeline Control<br/>Boolean flags"] --> K["build_libs<br/>Dependencies"]
        J --> L["vslam_map<br/>VSLAM processing"]
        J --> M["graph_prune<br/>Graph optimization"]
        J --> N["start_authoring<br/>Web interface"]
    end
    
    A --> E
    B --> E
    C --> E
    D --> E
    
    style A fill:#e1f5fe
    style E fill:#f3e5f5
    style J fill:#c8e6c9
```

## Deployment Architecture

### Docker Container Architecture

```mermaid
graph TB
    subgraph "Container Services"
        A[Backend Service<br/>Node.js] --> B[Port 3001<br/>Web Interface]
        A --> C[Volume Mounts<br/>Data Access]
        C --> D[Keyframe Images<br/>/app/served-img/]
        C --> E[Floorplan Images<br/>/app/served-floorplans/]
        C --> F[Database Files<br/>/app/served-map/]
    end
    
    subgraph "Environment Configuration"
        G[Production Mode<br/>NODE_ENV=production] --> A
        H[Path Configuration<br/>Environment variables] --> A
    end
    
    subgraph "External Services"
        I[Cloudflare R2<br/>Image Storage] --> A
        J[CDN<br/>Content Delivery] --> A
    end
    
    style A fill:#e1f5fe
    style I fill:#c8e6c9
    style J fill:#c8e6c9
```

### Multi-Environment Support

```mermaid
graph TB
    subgraph "Environment Types"
        A[Development<br/>Local Processing] --> B[Full Pipeline<br/>Debug Enabled]
        C[Staging<br/>Limited Processing] --> D[Restricted Content<br/>Testing]
        E[Production<br/>Public Content] --> F[Optimized Pipeline<br/>Privacy Protected]
    end
    
    subgraph "Configuration Profiles"
        G[dev.json<br/>Development] --> A
        H[tga.json<br/>Production] --> E
        I[uow-ham-pub.json<br/>Public] --> E
    end
    
    subgraph "Security Features"
        J[Content Stripping<br/>Sensitive Data] --> E
        K[Face Blurring<br/>Privacy Protection] --> E
        L[Access Control<br/>Environment Restrictions] --> A
        L --> C
        L --> E
    end
    
    style A fill:#e1f5fe
    style E fill:#c8e6c9
    style J fill:#ffebee
```

## Performance Architecture

### Optimization Strategies

```mermaid
graph TB
    subgraph "Spatial Optimization"
        A[Grid-Based Pruning<br/>5x5x5m boxes] --> B[60-80% Node Reduction<br/>Maintained Connectivity]
        C[Sharpness-Based Selection<br/>Image Quality] --> A
        D[Coordinate Scaling<br/>coords_to_metres] --> A
    end
    
    subgraph "Database Optimization"
        E[Table Prefixing<br/>Refined/Unrefined] --> F[Query Performance<br/>Indexed Access]
        G[Batch Operations<br/>Transaction Safety] --> E
        H[Working Copies<br/>Safe Processing] --> E
    end
    
    subgraph "Image Processing"
        I[Concurrent Processing<br/>ThreadPoolExecutor] --> J[Sharpness Calculation<br/>Variance of Laplacian]
        K[Batch Processing<br/>Configurable Size] --> I
        L[Image Compression<br/>Storage Optimization] --> I
    end
    
    style A fill:#e1f5fe
    style E fill:#f3e5f5
    style I fill:#c8e6c9
```

## Security Architecture

### Privacy Protection

```mermaid
graph TB
    subgraph "Content Management"
        A[Restricted Node Stripping<br/>Sensitive Locations] --> B[Public Database<br/>Sanitized Content]
        C[Face Blurring<br/>Privacy Protection] --> D[Processed Images<br/>Privacy Compliant]
        E[Access Control<br/>Environment Restrictions] --> F[Feature Gating<br/>Role-Based Access]
    end
    
    subgraph "Data Sanitization"
        G[Input Validation<br/>Parameter Checking] --> H[SQL Injection Prevention<br/>Parameterized Queries]
        I[File Upload Security<br/>Type Validation] --> J[Path Traversal Prevention<br/>Secure File Handling]
    end
    
    subgraph "Environment Security"
        K[Secret Management<br/>Encrypted Storage] --> L[API Key Protection<br/>Environment Variables]
        M[Network Security<br/>CORS Configuration] --> N[HTTPS Enforcement<br/>Secure Communication]
    end
    
    style A fill:#ffebee
    style C fill:#ffebee
    style E fill:#ffebee
```

## Monitoring Architecture

### Logging and Monitoring

```mermaid
graph TB
    subgraph "Log Management"
        A[Application Logs<br/>combined.log] --> B[Event Tracking<br/>User Actions]
        C[Error Logs<br/>error.log] --> D[Critical Failures<br/>Exception Handling]
        E[Exception Logs<br/>exceptions.log] --> F[Detailed Debugging<br/>Stack Traces]
    end
    
    subgraph "Performance Monitoring"
        G[API Response Times<br/>Request Tracking] --> H[Performance Metrics<br/>Response Analysis]
        I[Database Query Performance<br/>Query Optimization] --> H
        J[Memory Usage<br/>Resource Monitoring] --> H
        K[CPU Utilization<br/>System Metrics] --> H
    end
    
    subgraph "Winston Integration"
        L[Structured Logging<br/>JSON Format] --> M[Log Aggregation<br/>Centralized Collection]
        N[Log Levels<br/>DEBUG/INFO/WARN/ERROR] --> L
        O[Log Rotation<br/>File Management] --> L
    end
    
    style A fill:#e1f5fe
    style G fill:#f3e5f5
    style L fill:#c8e6c9
```

## Integration Architecture

### External Service Integration

```mermaid
graph TB
    subgraph "Cloud Services"
        A[Cloudflare R2<br/>Object Storage] --> B[Image Hosting<br/>CDN Distribution]
        C[CDN Integration<br/>Global Delivery] --> B
    end
    
    subgraph "Development Tools"
        D[Git Submodules<br/>Dependency Management] --> E[Version Control<br/>Component Tracking]
        F[Docker Compose<br/>Container Orchestration] --> G[Service Management<br/>Multi-Container]
    end
    
    subgraph "Third-Party Libraries"
        H[Stella VSLAM<br/>Computer Vision] --> I[Pose Tracking<br/>Spatial Mapping]
        J[Insta360 SDK<br/>Video Processing] --> K[Video Stitching<br/>360° Processing]
        L[THREE.js<br/>3D Graphics] --> M[WebGL Rendering<br/>3D Visualization]
    end
    
    style A fill:#e1f5fe
    style D fill:#f3e5f5
    style H fill:#c8e6c9
```

This architecture documentation provides a comprehensive overview of the Sitexplorer system's design, components, and relationships. The modular architecture allows for flexible deployment and customization while maintaining system integrity and performance.