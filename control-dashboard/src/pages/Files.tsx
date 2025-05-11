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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { io } from 'socket.io-client';

interface FileInfo {
  name: string;
  size: number;
  lastModified: string;
  path: string;
}

export default function Files() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = io('http://localhost:8080');

    socket.on('files', (data: { files: FileInfo[] }) => {
      setFiles(data.files);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleDeleteFile = (filePath: string) => {
    const socket = io('http://localhost:8080');
    socket.emit('delete-file', { filePath });
  };

  const handleDownloadFile = (filePath: string) => {
    window.open(`http://localhost:8080/download/${encodeURIComponent(filePath)}`, '_blank');
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
        Generated Files
      </Typography>

      <Paper sx={{ p: 2 }}>
        <List>
          {files.map((file) => (
            <ListItem key={file.path}>
              <ListItemText
                primary={file.name}
                secondary={`Size: ${(file.size / 1024 / 1024).toFixed(2)} MB | Last Modified: ${new Date(file.lastModified).toLocaleString()}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="download"
                  onClick={() => handleDownloadFile(file.path)}
                  sx={{ mr: 1 }}
                >
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteFile(file.path)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
} 