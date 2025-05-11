import { useEffect, useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { io } from 'socket.io-client';
import { ContainerStatus, FileSystemStatus } from '../types';

export default function Dashboard() {
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [filesystem, setFilesystem] = useState<FileSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = io('http://localhost:8080');

    socket.on('status', (data: { containers: ContainerStatus[]; filesystem: FileSystemStatus }) => {
      setContainers(data.containers);
      setFilesystem(data.filesystem);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Status
      </Typography>

      <Grid container spacing={3}>
        {/* Container Status */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Container Status
            </Typography>
            <Grid container spacing={2}>
              {containers.map((container) => (
                <Grid item xs={12} sm={6} md={4} key={container.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" component="div">
                        {container.name}
                      </Typography>
                      <Typography color="text.secondary">
                        Status: {container.status}
                      </Typography>
                      <Typography color="text.secondary">
                        Image: {container.image}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* File System Status */}
        {filesystem && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                File System Status
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(filesystem).map(([dir, stats]) => (
                  <Grid item xs={12} sm={4} key={dir}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" component="div">
                          {dir}
                        </Typography>
                        <Typography color="text.secondary">
                          Total: {(stats.total / 1024 / 1024 / 1024).toFixed(2)} GB
                        </Typography>
                        <Typography color="text.secondary">
                          Used: {(stats.used / 1024 / 1024 / 1024).toFixed(2)} GB
                        </Typography>
                        <Typography color="text.secondary">
                          Available: {(stats.available / 1024 / 1024 / 1024).toFixed(2)} GB
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
} 