# Campus Virtual Control Dashboard

A web-based control dashboard for managing the Campus Virtual generation pipeline.

## Features

- Real-time monitoring of container status
- Pipeline control and management
- File system monitoring and management
- System settings configuration
- Dark theme UI with Material-UI components

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Navigate to the project directory:
   ```bash
   cd control-dashboard
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Development

To start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Building for Production

To create a production build:

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Project Structure

```
control-dashboard/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   └── Layout.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Pipeline.tsx
│   │   ├── Files.tsx
│   │   └── Settings.tsx
│   ├── types.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── index.css
├── package.json
└── tsconfig.json
```

## Technologies Used

- React
- TypeScript
- Material-UI
- Socket.IO Client
- React Router

## License

MIT 