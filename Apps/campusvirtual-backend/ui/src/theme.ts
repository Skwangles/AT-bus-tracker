import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#E63946',
    },
    secondary: {
      main: '#222',
    },
    success: {
      main: '#43a047',
    },
    background: {
      default: '#1A1A2E',
      paper: 'rgba(230,57,70,0.92)',
    },
    text: {
      primary: '#fff',
      secondary: 'rgba(255,255,255,0.85)',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    fontWeightBold: 800,
    fontWeightRegular: 400,
  },
});

export default theme; 