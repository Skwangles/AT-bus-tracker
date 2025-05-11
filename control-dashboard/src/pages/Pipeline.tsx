import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import { io } from 'socket.io-client';
import { ContainerStatus } from '../types';

export default function Pipeline() {
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = io('http://localhost:8080');

    socket.on('status', (data: { containers: ContainerStatus[] }) => {
      setContainers(data.containers);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleStartContainer = (containerId: string) => {
    const socket = io('http://localhost:8080');
    socket.emit('start-container', { containerId });
  };

  const handleStopContainer = (containerId: string) => {
    const socket = io('http://localhost:8080');
    socket.emit('stop-container', { containerId });
  };

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
        Pipeline Control
      </Typography>

      <Grid container spacing={3}>
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
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  onClick={() => handleStartContainer(container.id)}
                  disabled={container.status === 'running'}
                >
                  Start
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleStopContainer(container.id)}
                  disabled={container.status !== 'running'}
                >
                  Stop
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
} 