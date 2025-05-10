# Authoring Backend

## Overview

The Authoring Backend is a core component of the Campus Virtual system that provides content authoring and management capabilities. It serves as the central service for creating, editing, and managing virtual campus content.

## Features

- Content creation and editing
- User management and permissions
- Version control for content
- Media asset management
- API integration with other components

## Architecture

The backend is built using a modern microservices architecture:

- API Gateway: Entry point for all requests
- Content Service: Handles content operations
- User Service: Manages user authentication and permissions
- Media Service: Handles media assets
- Database: Persistent storage
- Cache Layer: Performance optimization

## API Reference

### Authentication

#### POST /api/auth/login
Authenticate a user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "string",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

### Content Management

#### POST /api/content
Create new content.

**Request Body:**
```json
{
  "title": "string",
  "type": "string",
  "content": "object",
  "metadata": "object"
}
```

**Response:**
```json
{
  "id": "string",
  "status": "string",
  "createdAt": "string"
}
```

#### PUT /api/content/{id}
Update existing content.

**Request Body:**
```json
{
  "title": "string",
  "content": "object",
  "metadata": "object"
}
```

## Usage Examples

### Creating Content

```javascript
const response = await fetch('/api/content', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Campus Tour',
    type: 'tour',
    content: {
      locations: [],
      paths: []
    },
    metadata: {
      author: 'John Doe',
      version: '1.0'
    }
  })
});
```

### Updating Content

```javascript
const response = await fetch(`/api/content/${contentId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Updated Campus Tour',
    content: {
      locations: updatedLocations,
      paths: updatedPaths
    }
  })
});
```

## Configuration

The service can be configured through environment variables:

- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_NAME`: Database name
- `JWT_SECRET`: JWT secret key
- `REDIS_URL`: Redis connection URL
- `API_PORT`: API server port

## Development

### Prerequisites

- Node.js >= 14
- MongoDB >= 4.4
- Redis >= 6.0

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

### Database Setup

```bash
# Start MongoDB
mongod --dbpath /path/to/data

# Start Redis
redis-server
```

## Content Types

The system supports various content types:

1. **Tours**
   - Virtual campus tours
   - Guided paths
   - Points of interest

2. **Media**
   - Images
   - Videos
   - 360-degree panoramas

3. **Information**
   - Building details
   - Room information
   - Campus services

## Security

The backend implements several security measures:

- JWT-based authentication
- Role-based access control
- Input validation
- Rate limiting
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Troubleshooting

Common issues and their solutions:

1. **Authentication Issues**
   - Check JWT token expiration
   - Verify user credentials
   - Check role permissions

2. **Content Operations Fail**
   - Verify content format
   - Check user permissions
   - Review error logs

## Support

For support, please:
1. Check the documentation
2. Review existing issues
3. Create a new issue if needed 