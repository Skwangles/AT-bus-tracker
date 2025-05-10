# MapMerge

## Overview

The MapMerge component is a specialized tool for combining and merging multiple map data sources into a unified campus map. This component is essential for creating comprehensive campus visualizations by integrating various map formats, floor plans, and spatial data.

## Features

- Multi-format map data merging
- Automatic alignment and registration
- Conflict resolution
- Metadata preservation
- Version control support
- Export to multiple formats

## Architecture

The component is built with a focus on spatial data processing:

- Data Loader: Handles multiple input formats
- Alignment Engine: Manages spatial registration
- Merge Processor: Combines map data
- Conflict Resolver: Handles overlapping data
- Export Manager: Generates output in various formats

## Usage

### Command Line Interface

```bash
# Basic usage
mapmerge --input maps/*.json --output merged_map.json

# With alignment options
mapmerge --input maps/*.json --output merged_map.json --align auto --resolution high

# With conflict resolution
mapmerge --input maps/*.json --output merged_map.json --conflict-strategy newest
```

### Parameters

- `--input`: Input map files (required)
- `--output`: Output file path (required)
- `--align`: Alignment method (auto/manual) (default: auto)
- `--resolution`: Output resolution (low/medium/high) (default: medium)
- `--conflict-strategy`: Conflict resolution strategy (default: newest)

## Integration

### Python API

```python
from mapmerge import MapMerger

# Initialize merger
merger = MapMerger(
    alignment_method='auto',
    resolution='high',
    conflict_strategy='newest'
)

# Process maps
merger.merge(
    input_files=['map1.json', 'map2.json'],
    output_file='merged_map.json'
)
```

### Node.js API

```javascript
const { MapMerger } = require('mapmerge');

const merger = new MapMerger({
    alignmentMethod: 'auto',
    resolution: 'high',
    conflictStrategy: 'newest'
});

await merger.merge(['map1.json', 'map2.json'], 'merged_map.json');
```

## Supported Formats

### Input Formats
- GeoJSON
- KML/KMZ
- Shapefile
- CAD files (DXF/DWG)
- Image-based maps (with metadata)

### Output Formats
- GeoJSON
- KML
- Shapefile
- PNG/JPEG (with metadata)
- Custom JSON format

## Configuration

The component can be configured through environment variables or configuration files:

- `DEFAULT_ALIGNMENT`: Default alignment method
- `DEFAULT_RESOLUTION`: Default output resolution
- `CONFLICT_STRATEGY`: Default conflict resolution strategy
- `TEMP_DIR`: Directory for temporary files
- `MAX_MEMORY_USAGE`: Maximum memory usage in MB

## Development

### Prerequisites

- Python 3.8+
- GDAL
- NumPy
- OpenCV
- Shapely

### Setup

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Install the package:
   ```bash
   pip install -e .
   ```

### Building

```bash
python setup.py build
```

## Map Data Structure

The component works with a standardized map data structure:

```json
{
  "metadata": {
    "name": "string",
    "version": "string",
    "timestamp": "string",
    "source": "string"
  },
  "features": [
    {
      "type": "string",
      "geometry": {
        "type": "string",
        "coordinates": []
      },
      "properties": {}
    }
  ],
  "styles": {},
  "transform": {
    "scale": [],
    "translate": []
  }
}
```

## Best Practices

1. **Data Preparation**
   - Ensure consistent coordinate systems
   - Clean and validate input data
   - Preserve metadata

2. **Alignment**
   - Use common reference points
   - Consider scale differences
   - Verify alignment accuracy

3. **Conflict Resolution**
   - Define clear priorities
   - Document resolution decisions
   - Maintain data lineage

## Troubleshooting

Common issues and their solutions:

1. **Alignment Problems**
   - Check coordinate systems
   - Verify reference points
   - Adjust alignment parameters

2. **Data Conflicts**
   - Review conflict strategy
   - Check data priorities
   - Validate input data

3. **Performance Issues**
   - Optimize input data
   - Adjust resolution
   - Increase system resources

## Support

For support, please:
1. Check the documentation
2. Review existing issues
3. Create a new issue if needed 