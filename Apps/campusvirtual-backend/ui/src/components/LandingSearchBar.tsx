import React, { useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Label } from '../types';
import { getLabelLongName } from '../utils/labelUtils';

interface LandingSearchBarProps {
  labels: Label[];
  placeholder?: string;
}

const LandingSearchBar: React.FC<LandingSearchBarProps> = ({ labels, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();

  const handleSelect = (event: any, value: Label | null) => {
    if (value) {
      navigate(`/tour?id=${encodeURIComponent(value.query)}`);
    }
  };

  return (
    <Autocomplete
      options={labels}
      getOptionLabel={getLabelLongName}
      filterOptions={(options, { inputValue }) =>
        options.filter(option =>
          getLabelLongName(option).toLowerCase().includes(inputValue.toLowerCase())
        )
      }
      onChange={handleSelect}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue) => setInputValue(newInputValue)}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder || 'Search a location...'}
          variant="outlined"
          size="medium"
          slotProps={{
            input: {
              style: { borderRadius: 12 },
            },
          }}
        />
      )}
      sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}
      fullWidth
      disableClearable
    />
  );
};

export default LandingSearchBar; 