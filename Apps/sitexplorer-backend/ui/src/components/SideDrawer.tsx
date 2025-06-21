import React from 'react';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import HomeIcon from '@mui/icons-material/Home';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { LanguageSwitcher } from './LandingPage/LanguageSwitcher';
import { REPORT_PROBLEM_FORM_URL } from '../consts';
import { useTranslation } from 'react-i18next';
import { Info } from 'react-feather';

const LOGO_URL = '/logo.svg';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInfoClick: () => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, onInfoClick }) => {
  const { t } = useTranslation('common');

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      PaperProps={{
        sx: {
          background: '#F8FDFD',
          width: 300,
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          boxShadow: 4,
        },
      }}
    >
      {/* Logo with cloud background */}
      <Box
        sx={{
          background: '#E5F3F3',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 3,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <img src={LOGO_URL} alt={t('ui.logo.alt', 'Sitexplorer Logo')} style={{ height: 56, marginBottom: 8 }} />
        <Typography variant="h6" sx={{ color: '#1B1B1E', fontWeight: 700 }}>
          Sitexplorer
        </Typography>
      </Box>

      {/* Back to Home Button */}
      <Box sx={{ px: 3, py: 1 }}>
        <Button
          variant="outlined"
          startIcon={<HomeIcon />}
          fullWidth
          sx={{
            color: '#1B1B1E',
            borderColor: '#B6E7B0',
            mb: 1,
            textTransform: 'none',
            fontWeight: 600,
            background: '#E5F3F3',
            '&:hover': { background: '#B6E7B0', borderColor: '#B6E7B0' },
          }}
          onClick={() => window.location.href = '/'}
        >
          {t('ui.menu.backToHome', 'Back to Home')}
        </Button>
      </Box>

      {/* Info Button */}
      <Box sx={{ px: 3, py: 1 }}>
        <Button
          variant="outlined"
          startIcon={<Info />}
          fullWidth
          sx={{
            color: '#1B1B1E',
            borderColor: '#B6E7B0',
            textTransform: 'none',
            fontWeight: 600,
            background: '#E5F3F3',
            '&:hover': { background: '#B6E7B0', borderColor: '#B6E7B0' },
          }}
          onClick={onInfoClick}
        >
          {t('ui.menu.info', 'Info')}
        </Button>
      </Box>

      {/* Language Switcher */}
      <Box sx={{ px: 3, py: 1 }}>
        <LanguageSwitcher />
      </Box>

      {/* Report a Problem Button */}
      <Box sx={{ px: 3, py: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ReportProblemIcon />}
          fullWidth
          sx={{
            color: '#1B1B1E',
            borderColor: '#B6E7B0',
            textTransform: 'none',
            fontWeight: 600,
            background: '#E5F3F3',
            '&:hover': { background: '#B6E7B0', borderColor: '#B6E7B0' },
          }}
          onClick={() => window.open(REPORT_PROBLEM_FORM_URL, '_blank')}
        >
          {t('ui.menu.reportProblem', 'Report a Problem')}
        </Button>
      </Box>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Footer */}
      <Box
        sx={{
          background: '#B6E7B0',
          py: 2,
          px: 2,
          textAlign: 'center',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      >
        {/* Powered by link */}
        <Link
          href="https://sitexplorer.io"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#1B1B1E',
            textDecoration: 'none',
            fontWeight: 500,
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 'inherit' }}>
            {t('ui.menu.poweredBy', 'Powered by Sitexplorer.io')}
          </Typography>
        </Link>
      </Box>
    </Drawer>
  );
};

export default MobileDrawer; 