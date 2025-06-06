import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Paper,
  CircularProgress,
//   useTheme,
//   useMediaQuery,
} from '@mui/material';
// import { DirectionsWalk as WalkIcon, Elevator as ElevatorIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import LandingSearchBar from './LandingSearchBar';
import { API_PREFIX } from '../consts';
import { Label } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'transform 0.2s',
  '&:hover': {
    transform: 'scale(1.02)',
  },
}));

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation('common');
  const [searchableLabels, setSearchableLabels] = useState<Label[]>([]);
  const [loadingLabels, setLoadingLabels] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [suggestedLocations, setSuggestedLocations] = useState<{ title: string; description: string; pointId: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLabels = async () => {
      setLoadingLabels(true);
      setFetchError(null);
      try {
        const response = await fetch(`${API_PREFIX}/api/v1/locationgroup/labels`);
        if (!response.ok) throw new Error('Failed to fetch labels');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setSearchableLabels(data);
        } else {
          setSearchableLabels([]);
          setFetchError('noLocations');
        }
      } catch (e) {
        setSearchableLabels([]);
        setFetchError('fetchError');
      } finally {
        setLoadingLabels(false);
      }
    };
    fetchLabels();
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      setSuggestionsError(null);
      try {
        const response = await fetch(`${API_PREFIX}/api/v1/locationgroup/suggestions`);
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setSuggestedLocations(data);
        } else {
          setSuggestedLocations([]);
          setSuggestionsError('No suggestions available.');
        }
      } catch (e) {
        setSuggestedLocations([]);
        setSuggestionsError('Failed to fetch suggestions.');
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, []);

  const handleLocationClick = (pointId: string) => {
    navigate(`/tour?id=${pointId}`);
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
        position: 'relative',
      }}
    >
      {/* Language Switcher in top right */}
      <Box sx={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
        <LanguageSwitcher />
      </Box>
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box textAlign="center" mb={{ xs: 4, sm: 5, md: 6 }}>
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              fontWeight: 600,
            }}
          >
            CampusVirtual
          </Typography>
          <Typography
            variant="h4"
            color="text.secondary"
            gutterBottom
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
            }}
          >
            University of Waikato Tauranga Campus
          </Typography>
        </Box>

        <Paper
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            mb: { xs: 4, sm: 5, md: 6 },
            borderRadius: 2,
            maxWidth: 600,
            mx: 'auto',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
            }}
          >
            {t('homepage.howToUseTitle')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '0.875rem', sm: '1rem' },
              lineHeight: 1.6,
            }}
          >
            {t('homepage.howToUseText')}
          </Typography>
        </Paper>

        <Box sx={{ mb: { xs: 4, sm: 5, md: 6 }, width: '100%', maxWidth: 400, mx: 'auto', minHeight: 56 }}>
          {loadingLabels ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 56 }}>
              <CircularProgress size={28} />
            </Box>
          ) : fetchError ? (
            <Typography color="error" align="center">{t(`homepage.${fetchError}`)}</Typography>
          ) : (
            <LandingSearchBar labels={searchableLabels} placeholder={t('homepage.searchPlaceholder')} />
          )}
        </Box>

        <Grid
          container
          spacing={{ xs: 2, sm: 3 }}
          justifyContent="center"
        >
          {loadingSuggestions ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
                <CircularProgress size={28} />
              </Box>
            </Grid>
          ) : suggestionsError ? (
            <Grid item xs={12}>
              <Typography color="error" align="center">{suggestionsError}</Typography>
            </Grid>
          ) : suggestedLocations.map((location) => (
            <Grid item xs={12} sm={6} md={3} key={location.pointId}>
              <StyledCard>
                <CardActionArea onClick={() => handleLocationClick(location.pointId)}>
                  <CardContent
                    sx={{
                      textAlign: 'center',
                      py: { xs: 2, sm: 3 },
                      px: { xs: 1, sm: 2 },
                    }}
                  >
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{
                        fontSize: { xs: '1rem', sm: '1.25rem' },
                      }}
                    >
                      {location.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    >
                      {location.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default LandingPage; 