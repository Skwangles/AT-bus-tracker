import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import VirtualTour from './components/VirtualTour';
import ErrorLanding from './components/LandingPage/ErrorLanding';
import LandingPage from './components/LandingPage/LandingPage';
import { checkWebGLSupport, checkServerConnectivity } from './utils/errorChecks';

const App: React.FC = () => {
  const [error, setError] = useState<'server' | 'webgl' | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    console.log('App mounted, starting requirement checks...');
    const checkRequirements = async () => {
      setIsChecking(true);
      console.log('Checking requirements...');
      
      // First check WebGL support
      if (!checkWebGLSupport()) {
        console.log('WebGL check failed, showing error page');
        setError('webgl');
        setIsChecking(false);
        return;
      }

      // Then check server connectivity
      console.log('WebGL check passed, checking server connectivity...');
      const isServerConnected = await checkServerConnectivity();
      if (!isServerConnected) {
        console.log('Server connectivity check failed, showing error page');
        setError('server');
        setIsChecking(false);
        return;
      }

      console.log('All checks passed, showing main app');
      setError(null);
      setIsChecking(false);
    };

    checkRequirements();
  }, []);

  const handleRetry = async () => {
    console.log('Retry clicked, checking server connectivity...');
    setIsChecking(true);
    const isServerConnected = await checkServerConnectivity();
    if (isServerConnected) {
      console.log('Server now connected, showing main app');
      setError(null);
    } else {
      console.log('Server still not connected');
    }
    setIsChecking(false);
  };

  console.log('Current state:', { error, isChecking });

  return (
    <ThemeProvider theme={theme}>
      
      <Router>
        {isChecking ? (
          <div style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.01)',
            zIndex: 9999
          }}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <ErrorLanding errorType={error} onRetry={handleRetry} />
        ) : (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/tour" element={<VirtualTour />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Router>
    </ThemeProvider>
  );
};

export default App; 