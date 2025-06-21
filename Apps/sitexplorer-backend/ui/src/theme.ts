import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#D0EFEF',
    },
    secondary: {
      main: '#B6E7B0',
    },
    background: {
      default: '#D0EFEF',
      paper: '#F8FDFD',
    },
    text: {
      primary: '#1B1B1E',
      secondary: '#1B1B1E',
    },
    info: {
      main: '#E5F3F3',
    },
  },
  shape: {
    borderRadius: 5,
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    fontWeightBold: 800,
    fontWeightRegular: 400,
  },
});

export default theme; 