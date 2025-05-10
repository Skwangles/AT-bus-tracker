# Blur360-Images

## Overview

The Blur360-Images component is a specialized tool for processing and managing 360-degree images within the Campus Virtual system. It provides functionality for image processing, blur detection, and quality assessment of panoramic images.

## Features

- 360-degree image processing
- Automatic blur detection
- Image quality assessment
- Panoramic image stitching
- Image optimization

## Architecture

The component is built with a focus on image processing and quality:

- Image Processing Engine: Custom image processing algorithms
- Quality Assessment: Blur detection and image quality metrics
- Storage: Efficient image storage and retrieval
- API Layer: RESTful interface for integration

## API Reference

### Endpoints

#### POST /api/images/process
Process a 360-degree image.

**Request Body:**
```json
{
  "image": "Base64 encoded image data",
  "options": {
    "detectBlur": true,
    "optimize": true,
    "format": "string"
  }
}
```

**Response:**
```json
{
  "id": "string",
  "status": "string",
  "quality": {
    "blurScore": "number",
    "sharpness": "number"
  },
  "url": "string"
}
```

#### GET /api/images/{id}/quality
Get image quality metrics.

**Response:**
```json
{
  "blurScore": "number",
  "sharpness": "number",
  "resolution": {
    "width": "number",
    "height": "number"
  },
  "format": "string"
}
```

## Usage Examples

### Processing an Image

```javascript
const imageData = await readFileAsBase64(imageFile);
const response = await fetch('/api/images/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    image: imageData,
    options: {
      detectBlur: true,
      optimize: true,
      format: 'jpeg'
    }
  })
});
```

### Checking Image Quality

```javascript
const response = await fetch(`/api/images/${imageId}/quality`);
const qualityMetrics = await response.json();
```

## Configuration

The component can be configured through environment variables:

- `IMAGE_PROCESSING_THREADS`: Number of processing threads
- `MAX_IMAGE_SIZE`: Maximum image size in bytes
- `QUALITY_THRESHOLD`: Minimum acceptable quality score
- `SUPPORTED_FORMATS`: Comma-separated list of supported formats

## Development

### Prerequisites

- Python 3.8+
- OpenCV
- NumPy
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

3. Configure environment:
   ```bash
   cp .env.example .env
   ```

### Running Tests

```bash
pytest tests/
```

## Image Processing Pipeline

1. Image Upload
2. Format Validation
3. Quality Assessment
4. Blur Detection
5. Optimization
6. Storage

## Quality Metrics

The component uses several metrics to assess image quality:

- Blur Score (0-100)
- Sharpness Index
- Resolution Check
- Format Compliance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Troubleshooting

Common issues and their solutions:

1. **Image Processing Fails**
   - Check image format
   - Verify image size
   - Ensure sufficient memory

2. **Quality Assessment Issues**
   - Check image resolution
   - Verify image format
   - Review processing logs

## Support

For support, please:
1. Check the documentation
2. Review existing issues
3. Create a new issue if needed 