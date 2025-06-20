import React, { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { ArrowUpward, RotateLeft, RotateRight } from '@mui/icons-material';
import { MoveDirectionType } from '../types';

interface MobileControlsProps {
  onMove: (direction: MoveDirectionType) => void;
  onRotate: (direction: 'left' | 'right') => void;
  onStopRotate: () => void;
}

const MovementControls: React.FC<MobileControlsProps> = ({ onMove, onRotate, onStopRotate }) => {
  const [pressedButtons, setPressedButtons] = useState<Set<string>>(new Set());

  const handleButtonDown = (buttonType: string) => {
    setPressedButtons(prev => new Set(prev).add(buttonType));
    if (buttonType === 'rotateLeft') {
      onRotate('left');
    } else if (buttonType === 'rotateRight') {
      onRotate('right');
    }
  };

  const handleButtonUp = (buttonType: string) => {
    setPressedButtons(prev => {
      const newSet = new Set(prev);
      newSet.delete(buttonType);
      return newSet;
    });
    
    // Stop rotation if no rotation buttons are pressed
    if (buttonType === 'rotateLeft' || buttonType === 'rotateRight') {
      const remainingButtons = new Set(pressedButtons);
      remainingButtons.delete(buttonType);
      if (!remainingButtons.has('rotateLeft') && !remainingButtons.has('rotateRight')) {
        onStopRotate();
      }
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 2,
        bgcolor: 'rgba(255, 255, 255, 0.9)',
        p: 1,
        borderRadius: '16px',
        boxShadow: 3,
        zIndex: 1000,
      }}
    >
      <IconButton 
        onMouseDown={() => handleButtonDown('rotateLeft')}
        onMouseUp={() => handleButtonUp('rotateLeft')}
        onMouseLeave={() => handleButtonUp('rotateLeft')}
        onTouchStart={() => handleButtonDown('rotateLeft')}
        onTouchEnd={() => handleButtonUp('rotateLeft')}
        size="large"
        sx={{ 
          backgroundColor: pressedButtons.has('rotateLeft') ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
          transition: 'background-color 0.1s'
        }}
      >
        <RotateLeft fontSize="inherit" />
      </IconButton>
      <IconButton onClick={() => onMove(MoveDirectionType.Forward)} size="large">
        <ArrowUpward fontSize="inherit" />
      </IconButton>
      <IconButton 
        onMouseDown={() => handleButtonDown('rotateRight')}
        onMouseUp={() => handleButtonUp('rotateRight')}
        onMouseLeave={() => handleButtonUp('rotateRight')}
        onTouchStart={() => handleButtonDown('rotateRight')}
        onTouchEnd={() => handleButtonUp('rotateRight')}
        size="large"
        sx={{ 
          backgroundColor: pressedButtons.has('rotateRight') ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
          transition: 'background-color 0.1s'
        }}
      >
        <RotateRight fontSize="inherit" />
      </IconButton>
    </Box>
  );
};

export default MovementControls; 