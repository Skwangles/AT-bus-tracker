import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ArrivalAnimationProps {
  isVisible: boolean;
  destinationName: string;
  onAnimationComplete: () => void;
}

const ArrivalAnimation: React.FC<ArrivalAnimationProps> = ({ 
  isVisible, 
  destinationName, 
  onAnimationComplete 
}) => {
  const { t } = useTranslation('common');
  const [animationPhase, setAnimationPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');

  useEffect(() => {
    if (isVisible) {
      setAnimationPhase('entering');
      
      // Start the animation sequence
      const timer1 = setTimeout(() => {
        setAnimationPhase('visible');
      }, 100);

      const timer2 = setTimeout(() => {
        setAnimationPhase('exiting');
      }, 3000);

      const timer3 = setTimeout(() => {
        onAnimationComplete();
      }, 3500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isVisible, onAnimationComplete]);

  if (!isVisible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          px: 4,
          py: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white',
          transform: animationPhase === 'entering' 
            ? 'scale(0.8) translateY(20px)' 
            : animationPhase === 'exiting' 
            ? 'scale(0.9) translateY(-20px)' 
            : 'scale(1) translateY(0)',
          opacity: animationPhase === 'entering' 
            ? 0 
            : animationPhase === 'exiting' 
            ? 0 
            : 1,
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <CheckCircle 
          sx={{ 
            fontSize: 48, 
            animation: animationPhase === 'visible' ? 'bounce 0.6s ease-in-out' : 'none',
            '@keyframes bounce': {
              '0%, 20%, 50%, 80%, 100%': {
                transform: 'translateY(0)',
              },
              '40%': {
                transform: 'translateY(-10px)',
              },
              '60%': {
                transform: 'translateY(-5px)',
              },
            },
          }} 
        />
        <Typography 
          variant="h5" 
          sx={{ 
            fontWeight: 700, 
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {t('arrival.title', 'You have arrived at')}
        </Typography>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 800, 
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            color: '#E8F5E8',
          }}
        >
          {destinationName}
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            textAlign: 'center',
            opacity: 0.9,
            fontStyle: 'italic',
          }}
        >
          {t('arrival.subtitle', 'Destination reached!')}
        </Typography>
      </Paper>
    </Box>
  );
};

export default ArrivalAnimation; 