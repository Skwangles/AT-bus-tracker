# SharpnessCalculator

## Overview

The SharpnessCalculator component is a specialized tool for analyzing and quantifying image sharpness in the Campus Virtual system. It provides objective measurements of image quality, which is crucial for maintaining high-quality visual content throughout the virtual campus.

## Features

- Image sharpness analysis
- Multiple sharpness metrics
- Batch processing
- Quality reporting
- Integration with image processing pipeline
- Custom threshold configuration

## Architecture

The component is built with a focus on image analysis:

- Image Loader: Handles various image formats
- Analysis Engine: Core sharpness calculation
- Metric Calculator: Multiple sharpness metrics
- Report Generator: Quality assessment reports
- Integration Layer: API for other components

## Usage

### Command Line Interface

```bash
# Basic usage
sharpnesscalc --input image.jpg --output report.json

# With specific metrics
sharpnesscalc --input image.jpg --output report.json --metrics laplacian,sobel

# Batch processing
sharpnesscalc --input "images/*.jpg" --output reports/ --batch
```

### Parameters

- `--input`: Input image path (required)
- `--output`: Output file path (required)
- `--metrics`: Sharpness metrics to use (default: all)
- `--threshold`: Quality threshold (0-100) (default: 70)
- `--batch`: Enable batch processing mode

## Integration

### Python API

```python
from sharpnesscalc import SharpnessCalculator

# Initialize calculator
calculator = SharpnessCalculator(
    metrics=['laplacian', 'sobel'],
    threshold=70
)

# Analyze image
result = calculator.analyze(
    input_path='image.jpg',
    output_path='report.json'
)
```

### Node.js API

```javascript
const { SharpnessCalculator } = require('sharpnesscalc');

const calculator = new SharpnessCalculator({
    metrics: ['laplacian', 'sobel'],
    threshold: 70
});

await calculator.analyze('image.jpg', 'report.json');
```

## Sharpness Metrics

### Laplacian Variance
- Measures edge intensity
- Good for general sharpness
- Sensitive to noise

### Sobel Operator
- Edge detection based
- Directional analysis
- Less noise sensitive

### Tenengrad
- Gradient-based
- Good for natural images
- Robust to lighting

### Brenner's Focus
- Simple and fast
- Good for real-time
- Less accurate

## Output Format

The component generates detailed reports:

```json
{
  "image": {
    "path": "string",
    "size": "number",
    "dimensions": {
      "width": "number",
      "height": "number"
    }
  },
  "metrics": {
    "laplacian": "number",
    "sobel": "number",
    "tenengrad": "number",
    "brenner": "number"
  },
  "assessment": {
    "overall_score": "number",
    "threshold": "number",
    "passed": "boolean"
  },
  "metadata": {
    "timestamp": "string",
    "version": "string"
  }
}
```

## Configuration

The component can be configured through environment variables or configuration files:

- `DEFAULT_METRICS`: Default metrics to use
- `QUALITY_THRESHOLD`: Default quality threshold
- `BATCH_SIZE`: Number of images to process in parallel
- `TEMP_DIR`: Directory for temporary files
- `REPORT_FORMAT`: Output report format (json/csv)

## Development

### Prerequisites

- Python 3.8+
- OpenCV
- NumPy
- SciPy
- Pillow

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

- Processing time depends on:
  - Image size
  - Number of metrics
  - System resources
- Memory usage scales with:
  - Image dimensions
  - Batch size
  - Number of metrics

## Best Practices

1. **Metric Selection**
   - Choose appropriate metrics
   - Consider image type
   - Balance accuracy and speed

2. **Threshold Setting**
   - Test with sample images
   - Consider use case
   - Adjust based on results

3. **Batch Processing**
   - Monitor memory usage
   - Adjust batch size
   - Use appropriate resources

## Troubleshooting

Common issues and their solutions:

1. **Analysis Errors**
   - Check image format
   - Verify file permissions
   - Review error logs

2. **Performance Issues**
   - Reduce batch size
   - Select fewer metrics
   - Optimize system resources

3. **Inconsistent Results**
   - Check image quality
   - Verify metric settings
   - Review threshold values

## Support

For support, please:
1. Check the documentation
2. Review existing issues
3. Create a new issue if needed 