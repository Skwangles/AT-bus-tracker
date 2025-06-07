import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Container } from '@mui/material';
import { AlertCircle, RefreshCw, Globe } from 'react-feather';
import { useTranslation } from 'react-i18next';

interface ErrorLandingProps {
  errorType: 'server' | 'webgl';
  onRetry?: () => void;
}

const ErrorLanding: React.FC<ErrorLandingProps> = ({ errorType, onRetry }) => {
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (onRetry) {
      setIsRetrying(true);
      await onRetry();
      setIsRetrying(false);
    }
  };

  const renderContent = () => {
    if (errorType === 'server') {
      return (
        <>
          <AlertCircle size={64} color="#fff" style={{ background: '#E1251B', borderRadius: '50%' }} />
          <Typography variant="h4" component="h1" gutterBottom>
            {t('error.server.title', 'Unable to Connect to Server')}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {t('error.server.description', 'We couldn\'t establish a connection to the server. This might be due to:')}
          </Typography>
          <Box component="ul" sx={{ textAlign: 'left', mb: 3 }}>
            <Typography component="li" variant="body1" color="text.secondary">
              {t('error.server.reason1', 'The server might be offline or under maintenance')}
            </Typography>
            <Typography component="li" variant="body1" color="text.secondary">
              {t('error.server.reason2', 'Your internet connection might be unstable')}
            </Typography>
            <Typography component="li" variant="body1" color="text.secondary">
              {t('error.server.reason3', 'The server address might be incorrect')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshCw className={isRetrying ? 'animate-spin' : ''} />}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {t('error.server.retry', 'Retry Connection')}
          </Button>
        </>
      );
    }

    return (
      <>
        <Globe size={64} color="#E1251B" />
        <Typography variant="h4" component="h1" gutterBottom>
          {t('error.webgl.title', 'WebGL Not Supported')}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {t('error.webgl.description', 'Your browser doesn\'t support WebGL, which is required to run this application. This might be due to:')}
        </Typography>
        <Box component="ul" sx={{ textAlign: 'left', mb: 3 }}>
          <Typography component="li" variant="body1" color="text.secondary">
            {t('error.webgl.reason1', 'Your browser might be outdated')}
          </Typography>
          <Typography component="li" variant="body1" color="text.secondary">
            {t('error.webgl.reason2', 'WebGL might be disabled in your browser settings')}
          </Typography>
          <Typography component="li" variant="body1" color="text.secondary">
            {t('error.webgl.reason3', 'Your graphics card might not support WebGL')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
          >
            {t('error.webgl.reload', 'Reload Page')}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => window.open('https://get.webgl.org/', '_blank')}
          >
            {t('error.webgl.check', 'Check WebGL Support')}
          </Button>
        </Box>
      </>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
        m: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <Container maxWidth="sm" disableGutters sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            borderRadius: 2,
            width: '100%',
            maxWidth: 420,
          }}
        >
          {renderContent()}
        </Paper>
      </Container>
    </Box>
  );
};

export default ErrorLanding; 