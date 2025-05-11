import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import { io } from 'socket.io-client';

interface SystemSettings {
  modelPath: string;
  outputPath: string;
  maxConcurrentJobs: number;
  autoStart: boolean;
  notificationEnabled: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>({
    modelPath: '',
    outputPath: '',
    maxConcurrentJobs: 1,
    autoStart: false,
    notificationEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const socket = io('http://localhost:8080');

    socket.on('settings', (data: SystemSettings) => {
      setSettings(data);
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSave = () => {
    const socket = io('http://localhost:8080');
    socket.emit('save-settings', settings, (response: { success: boolean }) => {
      setSaveStatus(response.success ? 'success' : 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    });
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
        System Settings
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Model Path"
              value={settings.modelPath}
              onChange={(e) => setSettings({ ...settings, modelPath: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Output Path"
              value={settings.outputPath}
              onChange={(e) => setSettings({ ...settings, outputPath: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="number"
              label="Max Concurrent Jobs"
              value={settings.maxConcurrentJobs}
              onChange={(e) => setSettings({ ...settings, maxConcurrentJobs: parseInt(e.target.value) })}
              inputProps={{ min: 1, max: 10 }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoStart}
                  onChange={(e) => setSettings({ ...settings, autoStart: e.target.checked })}
                />
              }
              label="Auto-start Pipeline"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notificationEnabled}
                  onChange={(e) => setSettings({ ...settings, notificationEnabled: e.target.checked })}
                />
              }
              label="Enable Notifications"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              sx={{ mt: 2 }}
            >
              Save Settings
            </Button>
          </Grid>
          {saveStatus !== 'idle' && (
            <Grid item xs={12}>
              <Alert severity={saveStatus === 'success' ? 'success' : 'error'}>
                {saveStatus === 'success' ? 'Settings saved successfully!' : 'Failed to save settings.'}
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
} 