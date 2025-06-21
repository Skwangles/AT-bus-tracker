import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, Grid } from '@mui/material';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import MouseIcon from '@mui/icons-material/Mouse';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CasinoIcon from '@mui/icons-material/Casino';
import backgroundImg from '../../assets/landingpage.png';
import taurangaLogo from '../../assets/tauranga.png';
import theme from '../../theme';
import { useNavigate } from 'react-router-dom';
import { API_PREFIX } from '../../consts';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

const HOW_TO_KEYS = [
  { icon: <SearchIcon sx={{ fontSize: 32, color: '#fff', mb: 0.5 }} />, key: 'landing.howTo.search' },
  { icon: <MouseIcon sx={{ fontSize: 32, color: '#fff', mb: 0.5 }} />, key: 'landing.howTo.hotspots' },
  { icon: <DirectionsWalkIcon sx={{ fontSize: 32, color: '#fff', mb: 0.5 }} />, key: 'landing.howTo.move' },
];

const LandingPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const [suggested, setSuggested] = useState<{ pointId: string | number, title: string, description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomLoading, setRandomLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_PREFIX}/api/v1/locationgroup/suggestions`)
      .then(res => res.json())
      .then(data => {
        setSuggested(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      const res = await fetch(`${API_PREFIX}/api/v1/point/random`);
      const data = await res.json();
      if (data && data.keyframe_id) {
        navigate(`/tour?id=${data.keyframe_id}`);
      }
    } finally {
      setRandomLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          width: '100vw',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '::before': {
            content: '""',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundImage: `url(${backgroundImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px)',
            zIndex: 0,
          },
        }}
      >

        {/* Top-right Language Switcher */}
        <Box sx={{ position: 'fixed', top: 24, right: 32, zIndex: 2 }}>
          <LanguageSwitcher />
        </Box>

        {/* Centered Card */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            minWidth: { xs: 320, sm: 420, md: 540 },
            maxWidth: '90vw',
            px: { xs: 3, sm: 6 },
            py: { xs: 5, sm: 7 },
            borderRadius: muiTheme.shape.borderRadius,
            bgcolor: muiTheme.palette.background.paper,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            component="img"
            src={taurangaLogo}
            alt="University of Waikato - Tauranga"
            sx={{
              height: { xs: '100px', sm: '150px', md: '200px' },
              width: { xs: '100px', sm: '150px', md: '200px' },
              mb: 2,
              // filter: 'drop-shadow(0 2px 12px #000)',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
          <Typography
            variant="h6"
            sx={{
              color: muiTheme.palette.text.primary,
              fontWeight: muiTheme.typography.fontWeightRegular,
              mb: 3,
              textAlign: 'center',
              fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.25rem' },
              maxWidth: 520,
              opacity: 0.92,
            }}
          >
            {t('landing.welcome', "Welcome! Here's how to get started:")}
          </Typography>
          {/* How to use with icons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} mb={4} alignItems="center" justifyContent="center">
            {HOW_TO_KEYS.map((step, idx) => (
              <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 140 }}>
                {step.icon}
                <Typography sx={{ color: muiTheme.palette.text.primary, fontWeight: 500, fontSize: '1rem', textAlign: 'center' }}>{t(step.key)}</Typography>
              </Box>
            ))}
          </Stack>
          {/* Suggested starting points */}
          <Typography variant="subtitle1" sx={{ color: muiTheme.palette.text.primary, fontWeight: 600, mb: 2, textAlign: 'center', letterSpacing: 1 }}>
            {t('landing.suggested', 'Suggested Starting Points')}
          </Typography>
          <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={() => navigate('/tour')}
              sx={{
                background: muiTheme.palette.success.main,
                color: muiTheme.palette.text.primary,
                borderRadius: '999px',
                px: 4,
                py: 1.5,
                mb: 2,
                fontWeight: 700,
                fontSize: '1.1rem',
                textTransform: 'none',
                boxShadow: '0 2px 8px 0 rgba(67,160,71,0.12)',
                '&:hover': {
                  background: '#388e3c',
                  color: muiTheme.palette.text.primary,
                },
              }}
            >
              {t('landing.start', 'Start')}
            </Button>
          <Grid container spacing={2} justifyContent="center" wrap="wrap">
            {loading ? (
              <Grid item xs={12} sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: muiTheme.palette.text.primary, opacity: 0.8 }}>{t('ui.loading', 'Loading...')}</Typography>
              </Grid>
            ) : suggested.length === 0 ? (
              <Grid item xs={12} sx={{ textAlign: 'center' }}>
                <Typography sx={{ color: muiTheme.palette.text.primary, opacity: 0.8 }}>{t('landing.noSuggestions', 'No suggestions available.')}</Typography>
              </Grid>
            ) : suggested.map((s) => (
              <Grid item key={s.pointId}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate(`/tour?id=${s.pointId}`)}
                  sx={{
                    background: muiTheme.palette.secondary.main,
                    color: muiTheme.palette.text.primary,
                    borderRadius: '999px',
                    px: 2,
                    py: 2,
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    boxShadow: '0 2px 8px 0 rgba(0,0,0,0.12)',
                    textTransform: 'none',
                    mb: 1,
                    '&:hover': {
                      background: muiTheme.palette.text.primary,
                      color: muiTheme.palette.primary.main,
                    },
                  }}
                >
                  {t(`location.${s.title.toLowerCase().replace(/ /g, '')}`, s.title)}
                </Button>
                <Typography 
                  sx={{ 
                    color: muiTheme.palette.text.secondary, 
                    fontSize: '0.95rem', 
                    textAlign: 'center', 
                    maxWidth: '100%', 
                    wordBreak: 'break-word', 
                    whiteSpace: 'normal',
                    lineHeight: 1.35,
                  }}
                >
                  {t(`landing.${s.title.toLowerCase().replace(/ /g, '')}Description`, s.description)}
                </Typography>
              </Grid>
            ))}
          </Grid>
          {/* Start and Random buttons */}

            <Button
              variant="contained"
              color="secondary"
              startIcon={<CasinoIcon />}
              onClick={handleRandom}
              disabled={randomLoading}
              sx={{
                background: muiTheme.palette.secondary.main,
                color: muiTheme.palette.text.primary,
                borderRadius: '999px',
                px: 4,
                py: 1.5,
                fontWeight: 700,
                fontSize: '1.1rem',
                textTransform: 'none',
                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.12)',
                '&:hover': {
                  background: muiTheme.palette.text.primary,
                  color: muiTheme.palette.primary.main,
                },
              }}
            >
              {randomLoading ? t('ui.loading', 'Loading...') : t('landing.random', 'Random')}
            </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default LandingPage; 