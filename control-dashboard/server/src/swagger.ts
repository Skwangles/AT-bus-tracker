import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CampusVirtual Control Dashboard API',
      version: '1.0.0',
      description: 'API documentation for the CampusVirtual Control Dashboard',
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        Container: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['running', 'stopped'] },
            image: { type: 'string' },
            ports: { type: 'array', items: { type: 'string' } },
          },
        },
        FileSystemStatus: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            used: { type: 'number' },
            free: { type: 'number' },
          },
        },
        File: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            path: { type: 'string' },
            size: { type: 'number' },
            type: { type: 'string', enum: ['file', 'directory'] },
            modified: { type: 'string', format: 'date-time' },
          },
        },
        Settings: {
          type: 'object',
          properties: {
            // Add your settings properties here
          },
        },
      },
    },
  },
  apis: ['./src/index.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options); 