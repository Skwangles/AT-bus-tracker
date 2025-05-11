import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { getContainerStatus, startContainer, stopContainer } from './services/docker';
import { getFileSystemStatus, listFiles, deleteFile } from './services/filesystem';
import { loadSettings, saveSettings } from './services/settings';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../build')));

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
    await startContainer(req.params.id);
    res.json({ message: 'Container started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start container' });
  }
});

app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    await stopContainer(req.params.id);
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

app.get('/api/files', async (req, res) => {
  try {
    const directory = req.query.directory as string;
    const files = await listFiles(directory);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.delete('/api/files', async (req, res) => {
  try {
    const { filePath } = req.body;
    await deleteFile(filePath);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await loadSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    await saveSettings(req.body);
    res.json({ message: 'Settings saved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Socket.IO connection
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

  // Handle container control
  socket.on('start-container', async ({ containerId }) => {
    try {
      await startContainer(containerId);
      sendStatus();
    } catch (error) {
      console.error('Error starting container:', error);
    }
  });

  socket.on('stop-container', async ({ containerId }) => {
    try {
      await stopContainer(containerId);
      sendStatus();
    } catch (error) {
      console.error('Error stopping container:', error);
    }
  });

  // Handle file operations
  socket.on('delete-file', async ({ filePath }) => {
    try {
      await deleteFile(filePath);
      const files = await listFiles(path.dirname(filePath));
      socket.emit('files', { files });
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  });

  // Handle settings
  socket.on('save-settings', async (settings, callback) => {
    try {
      await saveSettings(settings);
      callback({ success: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      callback({ success: false });
    }
  });

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 