# GraphPruner

## Overview

The GraphPruner component is a specialized tool for optimizing and simplifying graph data structures used in the Campus Virtual system. It helps reduce complexity while maintaining essential connectivity information for navigation and spatial relationships.

## Features

- Graph simplification
- Path optimization
- Node reduction
- Edge pruning
- Connectivity preservation
- Performance optimization

## Architecture

The component is built with a focus on graph processing efficiency:

- Graph Loader: Handles input graph formats
- Pruning Engine: Core graph simplification logic
- Path Optimizer: Maintains critical paths
- Validation Module: Ensures graph integrity
- Export Manager: Generates optimized output

## Usage

### Command Line Interface

```bash
# Basic usage
graphpruner --input graph.json --output pruned_graph.json

# With optimization options
graphpruner --input graph.json --output pruned_graph.json --method path --threshold 0.8

# With specific pruning rules
graphpruner --input graph.json --output pruned_graph.json --rules rules.json
```

### Parameters

- `--input`: Input graph file (required)
- `--output`: Output file path (required)
- `--method`: Pruning method (path/density/connectivity) (default: path)
- `--threshold`: Pruning threshold (0-1) (default: 0.8)
- `--rules`: Custom pruning rules file (optional)

## Integration

### Python API

```python
from graphpruner import GraphPruner

# Initialize pruner
pruner = GraphPruner(
    method='path',
    threshold=0.8,
    rules_file='rules.json'
)

# Process graph
pruner.process(
    input_file='graph.json',
    output_file='pruned_graph.json'
)
```

### Node.js API

```javascript
const { GraphPruner } = require('graphpruner');

const pruner = new GraphPruner({
    method: 'path',
    threshold: 0.8,
    rulesFile: 'rules.json'
});

await pruner.process('graph.json', 'pruned_graph.json');
```

## Graph Data Structure

The component works with a standardized graph format:

```json
{
  "nodes": [
    {
      "id": "string",
      "type": "string",
      "properties": {},
      "position": {
        "x": "number",
        "y": "number",
        "z": "number"
      }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "properties": {},
      "weight": "number"
    }
  ],
  "metadata": {
    "version": "string",
    "timestamp": "string"
  }
}
```

## Pruning Methods

### Path-based Pruning
- Preserves critical navigation paths
- Removes redundant connections
- Maintains accessibility

### Density-based Pruning
- Reduces graph density
- Preserves connectivity
- Optimizes for performance

### Connectivity-based Pruning
- Maintains graph connectivity
- Removes isolated components
- Preserves essential paths

## Configuration

The component can be configured through environment variables or configuration files:

- `DEFAULT_METHOD`: Default pruning method
- `DEFAULT_THRESHOLD`: Default pruning threshold
- `MAX_NODES`: Maximum number of nodes
- `MAX_EDGES`: Maximum number of edges
- `TEMP_DIR`: Directory for temporary files

## Development

### Prerequisites

- Python 3.8+
- NetworkX
- NumPy
- SciPy

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

## Performance Considerations

- Memory usage scales with graph size
- Processing time depends on:
  - Number of nodes and edges
  - Pruning method
  - System resources

## Best Practices

1. **Graph Preparation**
   - Clean input data
   - Validate graph structure
   - Remove duplicate edges

2. **Pruning Strategy**
   - Choose appropriate method
   - Set reasonable thresholds
   - Test with sample data

3. **Validation**
   - Verify connectivity
   - Check path preservation
   - Validate output format

## Troubleshooting

Common issues and their solutions:

1. **Memory Issues**
   - Reduce graph size
   - Use batch processing
   - Increase system memory

2. **Connectivity Problems**
   - Check pruning threshold
   - Verify input data
   - Review pruning rules

3. **Performance Issues**
   - Optimize pruning method
   - Reduce graph complexity
   - Use appropriate thresholds

## Support

For support, please:
1. Check the documentation
2. Review existing issues
3. Create a new issue if needed 