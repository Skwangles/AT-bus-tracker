import React from 'react';
import { Paper, Typography } from '@mui/material';
import { LocationOn as LocationOnIcon, ChevronRight, ExpandMore } from '@mui/icons-material';

interface CurrentLocationProps {
  location: string;
  onClick: () => void;
  isOpen: boolean;
}

const CurrentLocation: React.FC<CurrentLocationProps> = ({ location, onClick, isOpen }) => {
  return (
    <Paper
      elevation={3}
      onClick={onClick}
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        color: '#1B1B1E',
        px: 3,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderRadius: '999px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }
      }}
    >
      <LocationOnIcon sx={{ color: 'text.primary', fontSize: 24 }} />
      <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
        {location || '...'}
      </Typography>
      {isOpen ? <ExpandMore /> : <ChevronRight />}
    </Paper>
  );
};

export default CurrentLocation; 