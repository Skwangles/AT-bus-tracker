import React, { useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Label } from '../../types';
import { getLabelLongName, getLabelDisplayName } from '../../utils/labelUtils';

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
        options.filter(option => {
          const value = inputValue.toLowerCase();
          const formattedLabel = getLabelLongName(option);
          const displayName = getLabelDisplayName(option);
          
          // Check if the current option matches
          const currentOptionMatches = 
            formattedLabel.toLowerCase().includes(value) ||
            displayName.toLowerCase().includes(value) ||
            option.parents.some(parent => parent.toLowerCase().includes(value));
          
          // Check if any children match
          const childrenMatch = option.children && option.children.some(child => {
            const childFormattedLabel = getLabelLongName(child);
            const childDisplayName = getLabelDisplayName(child);
            return (
              childFormattedLabel.toLowerCase().includes(value) ||
              childDisplayName.toLowerCase().includes(value) ||
              child.parents.some(parent => parent.toLowerCase().includes(value))
            );
          });
          
          return currentOptionMatches || childrenMatch;
        })
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