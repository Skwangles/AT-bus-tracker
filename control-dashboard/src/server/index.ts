import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const docker = new Docker();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Docker container management
async function getContainerStatus(): Promise<any[]> {
  const containers = await docker.listContainers({ all: true });
  return containers.map(container => ({
    id: container.Id,
    name: container.Names[0].replace('/', ''),
    status: container.State,
    state: container.Status,
    ports: container.Ports,
    created: container.Created,
    image: container.Image
  }));
}

// File system monitoring
async function getFileSystemStatus(): Promise<any> {
  const videoDir = process.env.CV_VIDEO_DIR || '/app/videos';
  const imageDir = process.env.CV_KEYFRAME_IMG_DIR || '/app/images';
  const dbDir = process.env.CV_DB_DIR || '/app/db';

  const getDirStats = async (dir: string) => {
    const { stdout } = await execAsync(`df -B1 ${dir}`);
    const lines = stdout.split('\n')[1].split(/\s+/);
    return {
      total: parseInt(lines[1]),
      used: parseInt(lines[2]),
      available: parseInt(lines[3])
    };
  };

  return {
    videoDir: await getDirStats(videoDir),
    imageDir: await getDirStats(imageDir),
    dbDir: await getDirStats(dbDir)
  };
}

// API Routes
app.get('/api/containers', async (req, res) => {
  try {
    const containers = await getContainerStatus();
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get container status' });
  }
});

app.post('/api/containers/:id/start', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ message: 'Container started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start container' });
  }
});

app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ message: 'Container stopped' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop container' });
  }
});

app.get('/api/filesystem', async (req, res) => {
  try {
    const status = await getFileSystemStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get filesystem status' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send initial status
  const sendStatus = async () => {
    try {
      const containers = await getContainerStatus();
      const filesystem = await getFileSystemStatus();
      socket.emit('status', { containers, filesystem });
    } catch (error) {
      console.error('Error sending status:', error);
    }
  };

  // Send status every 5 seconds
  const interval = setInterval(sendStatus, 5000);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 