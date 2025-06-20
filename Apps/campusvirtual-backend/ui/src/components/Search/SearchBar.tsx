import React, {
  useState,
  ChangeEvent,
  useEffect,
} from "react";
import "../../css/SearchBar.css";
import { toast } from "react-toastify";
import { getLabelLongName, getLabelDisplayName } from "../../utils/labelUtils";
import { Label } from "../../types";
import { useTranslation } from "react-i18next";
import { Button, ButtonGroup, TextField, InputAdornment, IconButton, Paper, Box } from "@mui/material";
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import DropDownContainer from "./DropDownContainer";

// Define the type for the props
interface SearchBarProps {
  currentPoint: { location: string };
  searchableLabels: Label[];
  jumpToCallback: (selected: string) => void;
  highlightCallback: (selected: string) => void;
  isPathfindingMode?: boolean;
  onClose: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  currentPoint,
  searchableLabels,
  jumpToCallback,
  highlightCallback,
  isPathfindingMode,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Label[]>([]);
  const [recentSearches, setRecentSearches] = useState<Label[]>(() => {
    const saved = localStorage.getItem("recentSearches");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    // Populate initial suggestions when the component mounts
    setSuggestions(
      searchableLabels.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
    );
  }, [searchableLabels]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc, false);
    return () => {
      document.removeEventListener("keydown", handleEsc, false);
    };
  }, [onClose]);

  const addToRecent = (location: Label) => {
    const updated = [
      location,
      ...recentSearches.filter((item) => item.query !== location.query),
    ].slice(0, 3);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toLowerCase();
    setQuery(value);
    if (value) {
      const filteredSuggestions = searchableLabels.filter((item) => {
        const formattedLabel = getLabelLongName(item);
        const displayName = getLabelDisplayName(item);
        
        // Check if the current item matches
        const currentItemMatches = 
          formattedLabel.toLowerCase().includes(value) ||
          displayName.toLowerCase().includes(value) ||
          item.parents.some(parent => parent.toLowerCase().includes(value));
        
        // Check if any children match
        const childrenMatch = item.children && item.children.some(child => {
          const childFormattedLabel = getLabelLongName(child);
          const childDisplayName = getLabelDisplayName(child);
          return (
            childFormattedLabel.toLowerCase().includes(value) ||
            childDisplayName.toLowerCase().includes(value) ||
            child.parents.some(parent => parent.toLowerCase().includes(value))
          );
        });
        
        return currentItemMatches || childrenMatch;
      });
      setSuggestions(
        filteredSuggestions.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
      );
    } else {
      setSuggestions(
        searchableLabels.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
      );
    }
  };

  const handleSuggestionClick = (suggestion: Label) => {
    setQuery(getLabelLongName(suggestion));
  };

  const handleAction = (label: string, action: "highlight" | "jump") => {
    if (isPathfindingMode && label === "" && action === "highlight") {
      highlightCallback("");
      return;
    }

    let labelObj = searchableLabels.find((v: Label) =>
      getLabelLongName(v).toLowerCase().includes(label.toLowerCase())
    );
    if (!labelObj) {
      labelObj = searchableLabels.find(
        (v: Label) => v.label.toLowerCase() === label.toLowerCase()
      );
    }

    if (!labelObj || !labelObj.query || !labelObj.label) {
      toast.error(t('errors.invalidLabel', { label }));
      return;
    }

    addToRecent(labelObj);
    if (action === "highlight") {
      highlightCallback(labelObj.query);
    } else {
      jumpToCallback(labelObj.query);
    }
    setQuery(getLabelLongName(labelObj));
    onClose();
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions(
      searchableLabels.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
    );
  };

  const isQueryInLabels = searchableLabels.some(
    (val) =>
      getLabelLongName(val).toLowerCase() ===
      query.toLowerCase()
  );

  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, paddingTop: '8px' }}>
      <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #E5F3F3', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        {/* Non-scrollable part */}
        <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={handleChange}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: '#F8FDFD',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#D0EFEF',
              },
            }}
            InputProps={{
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton onClick={clearSearch} edge="end">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <ButtonGroup variant="text" aria-label="action button group">
              <Button
                onClick={() => handleAction(query, 'highlight')}
                disabled={!query || (!isQueryInLabels && !isPathfindingMode)}
                startIcon={isPathfindingMode ? <ClearIcon /> : <VisibilityOutlinedIcon />}
                size="small"
                sx={{
                  color: '#1B1B1E',
                }}
              >
                {isPathfindingMode ? t('search.buttons.clearPath') : t('search.buttons.guide')}
              </Button>
              <Button
                onClick={() => handleAction(query, 'jump')}
                disabled={!query || !isQueryInLabels}
                startIcon={<NearMeOutlinedIcon />}
                size="small"
                sx={{
                  color: '#1B1B1E',
                }}
              >
                {t('search.buttons.goTo')}
              </Button>
            </ButtonGroup>
          </Box>
        </Box>

        {/* Scrollable part */}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          <DropDownContainer
            recentSearches={recentSearches}
            query={query}
            suggestions={suggestions}
            handleSuggestionClick={handleSuggestionClick}
            currentLocationGroup={currentPoint.location}
          />
        </Box>
      </Paper>
    </div>
  );
};

export default SearchBar;
