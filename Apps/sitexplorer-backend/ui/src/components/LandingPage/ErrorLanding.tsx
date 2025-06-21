import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Container, useTheme } from '@mui/material';
import { RefreshCw, Globe } from 'react-feather';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { useTranslation } from 'react-i18next';

interface ErrorLandingProps {
  errorType: 'server' | 'webgl';
  onRetry?: () => void;
}

const ErrorLanding: React.FC<ErrorLandingProps> = ({ errorType, onRetry }) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#E1251B',
              mb: 2,
            }}
          >
            <PriorityHighIcon sx={{ color: theme.palette.background.paper, fontSize: 40 }} />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: theme.palette.text.primary, fontWeight: theme.typography.fontWeightBold }}>
            {t('error.server.title', 'Unable to Connect to Sitexplorer\'s Server')}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph sx={{ color: theme.palette.text.secondary }}>
            {t('error.server.description', 'We couldn\'t establish a connection to the server. This might be due to:')}
          </Typography>
          <Box component="ul" sx={{ textAlign: 'left', mb: 3 }}>
            <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
              {t('error.server.reason1', 'The server might be offline or under maintenance')}
            </Typography>
            <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
              {t('error.server.reason2', 'Your internet connection might be unstable')}
            </Typography>
            <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
              {t('error.server.reason3', 'The server address might be incorrect')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshCw className={isRetrying ? 'animate-spin' : ''} />}
            onClick={handleRetry}
            disabled={isRetrying}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.text.primary,
              fontWeight: theme.typography.fontWeightBold,
              textTransform: 'none',
              borderRadius: theme.shape.borderRadius,
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              },
              '&:disabled': {
                backgroundColor: theme.palette.info.main,
                color: theme.palette.text.secondary,
              }
            }}
          >
            {t('error.server.retry', 'Retry Connection')}
          </Button>
        </>
      );
    }

    return (
      <>
        <Globe size={64} color="#E1251B" />
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: theme.palette.text.primary, fontWeight: theme.typography.fontWeightBold }}>
          {t('error.webgl.title', 'WebGL Not Supported')}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ color: theme.palette.text.secondary }}>
          {t('error.webgl.description', 'Your browser doesn\'t support WebGL, which is required to run this application. This might be due to:')}
        </Typography>
        <Box component="ul" sx={{ textAlign: 'left', mb: 3 }}>
          <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
            {t('error.webgl.reason1', 'Your browser might be outdated')}
          </Typography>
          <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
            {t('error.webgl.reason2', 'WebGL might be disabled in your browser settings')}
          </Typography>
          <Typography component="li" variant="body1" color="text.secondary" sx={{ color: theme.palette.text.secondary }}>
            {t('error.webgl.reason3', 'Your graphics card might not support WebGL')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              color: theme.palette.text.primary,
              fontWeight: theme.typography.fontWeightBold,
              textTransform: 'none',
              borderRadius: theme.shape.borderRadius,
              '&:hover': {
                backgroundColor: theme.palette.primary.main,
              }
            }}
          >
            {t('error.webgl.reload', 'Reload Page')}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => window.open('https://get.webgl.org/', '_blank')}
            sx={{
              color: theme.palette.text.primary,
              borderColor: theme.palette.secondary.main,
              fontWeight: theme.typography.fontWeightBold,
              textTransform: 'none',
              borderRadius: theme.shape.borderRadius,
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: theme.palette.info.main,
              }
            }}
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
            borderRadius: '60px',
            width: '100%',
            maxWidth: 420,
            bgcolor: 'background.paper',
            border: `1px solid ${theme.palette.info.main}`,
          }}
        >
          {renderContent()}
        </Paper>
      </Container>
    </Box>
  );
};

export default ErrorLanding; 