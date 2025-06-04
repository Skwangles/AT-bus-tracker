import React from 'react';
import { Eye, ArrowUpRight, X } from 'react-feather'
import { getLabelLongName } from '../../utils/labelUtils'
import { Label } from '../../types'
import { Paper, Typography } from '@mui/material';
import { LocationOn as LocationOnIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface SearchBarButtonsProps {
  currentPoint: { location: string };
  query: string;
  isPathfindingMode?: boolean;
  handleAction: (label: string, action: 'highlight' | 'jump') => void;
  labels: Label[];
}

const SearchBarButtons: React.FC<SearchBarButtonsProps> = ({
  currentPoint,
  query,
  isPathfindingMode,
  handleAction,
  labels,
}) => {
  const { t } = useTranslation('common');

  const handleJumpTo = () => {
    handleAction(query, 'jump');
  };

  const handleHighlight = () => {
    handleAction(query, 'highlight');
  };

  const isCurrentLocation = labels.some(
    (val) =>
      getLabelLongName(val).toLowerCase() ===
      currentPoint.location.toLowerCase()
  );

  return (
    <div className="flex w-full gap-2 mt-2">
      <Paper
        elevation={3}
        sx={{
          bgcolor: 'rgba(16,16,16,0.7)', // dark frosted glass
          backdropFilter: 'blur(8px)',
          color: 'white',
          px: 2.5,
          py: 1.2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: '999px', // pill shape
          boxShadow: 3,
          minWidth: 0,
        }}
      >
        <LocationOnIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="body1" sx={{ fontWeight: 500, ml: 0.5, color: 'white' }}>
          {currentPoint.location}
        </Typography>
      </Paper>
      <button
        onClick={handleHighlight}
        className={` ${
          isPathfindingMode ? 'bg-red-500' : 'bg-blue-500'
        } flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white  rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors`}
        disabled={!query || (!isCurrentLocation && !isPathfindingMode)}
        aria-label={t('search.buttons.ariaLabels.highlight')}
      >
        {isPathfindingMode ? (
          <X size={14} aria-hidden="true" />
        ) : (
          <Eye size={14} aria-hidden="true" />
        )}

        {isPathfindingMode ? t('search.buttons.clearPath') : t('search.buttons.guide')}
      </button>
      <button
        onClick={handleJumpTo}
        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        disabled={!query || !isCurrentLocation}
        aria-label={t('search.buttons.ariaLabels.goto')}
      >
        <ArrowUpRight size={14} aria-hidden="true" /> {t('search.buttons.goTo')}
      </button>
    </div>
  )
}

export default SearchBarButtons;
