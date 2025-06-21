import React, { useMemo, useState } from 'react';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
  Typography,
  useTheme,
} from '@mui/material';
import { ArrowUp, ChevronDown, ChevronRight, User } from 'react-feather';
import { getLabelDisplayName, getLabelLongName, toTitleCase } from '../../utils/labelUtils';
import { Label, LabelType } from '../../types';
import { Navigation } from '@mui/icons-material';

interface DropDownContainerProps {
  recentSearches: Label[];
  query: string;
  suggestions: Label[];
  handleSuggestionClick: (suggestion: Label, hide?: boolean) => void;
  currentLocationGroup: string;
}


const StyledListItem = styled(ListItem)(({ theme }) => ({
  '& .MuiListItemText-primary': {
    color: theme.palette.common.black,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    '& .MuiListItemText-primary': {
      color: theme.palette.common.black,
    },
  },
  cursor: 'pointer',
  padding: theme.spacing(1, 2),
  transition: theme.transitions.create(['background-color', 'color'], {
    duration: theme.transitions.duration.shortest,
  }),
}));

const DropDownContainer: React.FC<DropDownContainerProps> = ({
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
  currentLocationGroup,
}) => {
  const theme = useTheme();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(currentLocationGroup ? [currentLocationGroup] : []),
  );

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  // Group suggestions by floor
  const groupedSuggestions = useMemo(() => {
    const groups: { [key: string]: { self: Label | null, rooms: Label[], elevators: Label[], toilets: Label[] } } = {};

    suggestions.filter(label => label.type === LabelType.GroupName).forEach(label => {
      if (label.query.toLowerCase().endsWith('- staircase')) return;

      const groupName = label.query;
      groups[groupName] = { self: label, rooms: [], elevators: [], toilets: [] };

      const seenLabels = new Set<string>();
      label.children.forEach(child => {
        const uniqueKey = `${child.pointId}-${child.label}`;
        if (seenLabels.has(uniqueKey)) {
          return;
        }
        seenLabels.add(uniqueKey);

        switch (child.type) {
          case LabelType.Normal:
            groups[groupName].rooms.push(child);
            break;
          case LabelType.Toilet:
            groups[groupName].toilets.push(child);
            break;
          case LabelType.Elevator:
            groups[groupName].elevators.push(child);
            break;
        }
      });
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'B') return -1;
      if (b === 'B') return 1;
      if (a === 'G') return -1;
      if (b === 'G') return 1;
      return parseInt(a) - parseInt(b);
    });
  }, [suggestions]);

  const renderLabel = (label: Label, keyPrefix: string, depth: number = 0, showChildren: boolean = true) => {
    const hasChildren = showChildren && label.type !== LabelType.Elevator && label.children && label.children.length > 0;
    const isExpanded = expandedGroups.has(label.query);
    const isCurrent = label.query === currentLocationGroup;

    const getIcon = () => {
      switch (label.type) {
        case LabelType.Elevator:
          return <ArrowUp className="h-4 w-4" />;
        case LabelType.Toilet:
          return <User className="h-4 w-4" />;
        case LabelType.GroupName:
          return <Navigation sx={{ width: 16, height: 16 }} />;
        default:
          return null;
      }
    };

    return (
      <Box key={`${keyPrefix}-${label.pointId}-${label.label}`} sx={{ pl: depth * 2 }}>
        <StyledListItem
          onClick={() => handleSuggestionClick(label)}
          sx={{
            '& .MuiListItemText-primary': {
              color: theme.palette.common.black,
            },
            ...(isCurrent && {
              background: 'rgba(230, 247, 255, 1)',
              borderLeft: `4px solid ${theme.palette.primary.main}`,
            }),
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGroup(label.query);
                }}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </IconButton>
            )}
            {getIcon()}
          </ListItemIcon>
          <ListItemText primary={getLabelDisplayName(label)} sx={{ color: theme.palette.common.black }} />
        </StyledListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {label.children.map((child) => renderLabel(child, `${keyPrefix}-child`, depth + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const renderSelf = (label: Label, groupName: string) => {
    return (
      <Box key={`group-${label.pointId}-${label.label}`} sx={{ pl: 2 }}>
        <StyledListItem
          onClick={() => handleSuggestionClick(label)}
          sx={{
            '& .MuiListItemText-primary': {
              color: theme.palette.common.black,
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Navigation sx={{ width: 16, height: 16 }} />
          </ListItemIcon>
          <ListItemText primary={`Go to ${toTitleCase(groupName)}`} sx={{ color: theme.palette.common.black }} />
        </StyledListItem>
      </Box>
    );
  };

  const uniqueRecentSearches = useMemo(() => {
    return [...new Set(recentSearches.map(recent => recent.query))]
      .map(query => recentSearches.find(recent => recent.query === query))
      .filter(recent => recent !== undefined);
  }, [recentSearches]);

  return (
    <Box>
      {!query && uniqueRecentSearches.length > 0 && (
        <>
          <Typography
            variant="subtitle2"
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'grey.100',
              color: 'text.secondary',
              textTransform: 'uppercase',
            }}
          >
            Recent Searches
          </Typography>
          <List>
            {uniqueRecentSearches.map((recent) => recent && renderLabel(recent, 'recent-searches', 0, false))}
          </List>
          <Divider />
        </>
      )}

      <Typography
        variant="subtitle2"
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.100',
          color: 'text.secondary',
          textTransform: 'uppercase',
        }}
      >
        Suggestions
      </Typography>
      
      <List>
        {groupedSuggestions.map(([groupName, items]) => (
          <Box key={groupName}>
            <StyledListItem
              onClick={() => toggleGroup(groupName)}
              sx={{
                fontWeight: 'medium',
                '& .MuiListItemText-primary': {
                  color: theme.palette.common.black,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <IconButton size="small">
                  {expandedGroups.has(groupName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </IconButton>
              </ListItemIcon>
              <ListItemText primary={toTitleCase(groupName)} sx={{ color: theme.palette.common.black }} />
            </StyledListItem>
            <Collapse in={expandedGroups.has(groupName)} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {items.self && renderSelf(items.self, groupName)}
                {(query ? items.elevators.filter(label => getLabelLongName(label).toLowerCase().includes(query.toLowerCase())) : items.elevators).map(label => renderLabel(label, 'elevators', 1))}
                {(query ? items.toilets.filter(label => getLabelLongName(label).toLowerCase().includes(query.toLowerCase())) : items.toilets).map(label => renderLabel(label, 'toilets', 1))}
                {(query ? items.rooms.filter(label => getLabelLongName(label).toLowerCase().includes(query.toLowerCase())) : items.rooms).map(label => renderLabel(label, 'rooms', 1))}
              </List>
            </Collapse>
          </Box>
        ))}
      </List>
    </Box>
  );
};

export default DropDownContainer;
