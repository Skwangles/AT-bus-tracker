import React, { useState, useMemo } from 'react'
import { Label, LabelType } from '../../types'
import { getLabelDisplayName } from '../../utils/labelUtils'
import { ChevronDown, ChevronRight, ArrowUp, User } from 'react-feather'
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Typography,
  Paper,
  Divider,
  IconButton,
  Box
} from '@mui/material'
import { styled, useTheme } from '@mui/material/styles'

interface DropDownContainerProps {
  setIsFocused: (isFocused: boolean) => void
  dropdownRef: React.RefObject<HTMLDivElement>
  recentSearches: Label[]
  query: string
  suggestions: Label[]
  handleSuggestionClick: (suggestion: Label, hide?: boolean) => void
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  maxHeight: '400px',
  overflowY: 'auto',
  zIndex: 50,
  marginTop: theme.spacing(1),
  boxShadow: theme.shadows[3],
  backgroundColor: theme.palette.common.white,
  color: theme.palette.common.black,
}))

const StyledListItem = styled(ListItem)(({ theme }) => ({
  '& .MuiListItemText-primary': {
    color: theme.palette.common.black
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    '& .MuiListItemText-primary': {
      color: theme.palette.common.black
    }
  },
  cursor: 'pointer',
  padding: theme.spacing(1, 2),
  transition: theme.transitions.create(['background-color', 'color'], {
    duration: theme.transitions.duration.shortest
  })
}))

const DropDownContainer: React.FC<DropDownContainerProps> = ({
  setIsFocused,
  dropdownRef,
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
}) => {
  const theme = useTheme();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }

  // Group suggestions by floor
  const groupedSuggestions = useMemo(() => {
    const groups: { [key: string]: { self: Label | null, rooms: Label[], elevators: Label[], toilets: Label[] } } = {}
    
    suggestions.filter(label => label.type === LabelType.GroupName).forEach(label => {
      if (label.query.toLowerCase().endsWith('- staircase')) return
      
      const groupName = label.query
      groups[groupName] = { self: label, rooms: [], elevators: [], toilets: [] }
      
      label.children.forEach(child => {
        switch (child.type) {
          case LabelType.Normal:
            groups[groupName].rooms.push(child)
            break
          case LabelType.Toilet:
            groups[groupName].toilets.push(child)
            break
          case LabelType.Elevator:
            groups[groupName].elevators.push(child)
            break
        }
      })
    })

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'B') return -1
      if (b === 'B') return 1
      if (a === 'G') return -1
      if (b === 'G') return 1
      return parseInt(a) - parseInt(b)
    })
  }, [suggestions])

  const renderLabel = (label: Label, keyPrefix: string, depth: number = 0, showChildren: boolean = true) => {
    const hasChildren = showChildren && label.type !== LabelType.Elevator && label.children && label.children.length > 0
    const isExpanded = expandedGroups.has(label.query)

    const getIcon = () => {
      switch (label.type) {
        case LabelType.Elevator:
          return <ArrowUp className="h-4 w-4" />
        case LabelType.Toilet:
          return <User className="h-4 w-4" />
        default:
          return null
      }
    }

    return (
      <Box key={keyPrefix + label.query} sx={{ pl: depth * 2 }}>
        <StyledListItem
          onClick={() => handleSuggestionClick(label)}
          sx={{
            '& .MuiListItemText-primary': {
              color: theme.palette.common.black
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleGroup(label.query)
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
              {label.children.map((child) => renderLabel(child, keyPrefix + "-child", depth + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    )
  }

  const uniqueRecentSearches = useMemo(() => {
    return [...new Set(recentSearches.map(recent => recent.query))]
      .map(query => recentSearches.find(recent => recent.query === query))
      .filter(recent => recent !== undefined)
  }, [recentSearches])

  return (
    <StyledPaper
      ref={dropdownRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsFocused(false)
        }
      }}
      sx={{
        bgcolor: theme.palette.common.white,
        color: theme.palette.common.black,
      }}
    >
      {!query && recentSearches.length > 0 && (
        <>
          <Typography
            variant="subtitle2"
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'grey.100',
              color: 'text.secondary',
              textTransform: 'uppercase'
            }}
          >
            Recent Searches
          </Typography>
          <List>
            {uniqueRecentSearches.map((recent) => renderLabel(recent, "recent-searches", 0, false))}
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
          textTransform: 'uppercase'
        }}
      >
        Suggestions
      </Typography>
      
      <List>
        {groupedSuggestions.map(([groupName, items]) => (
          <Box key={groupName}>
            <StyledListItem
              onClick={() => toggleGroup(groupName)}
              sx={{ fontWeight: 'medium',
                '& .MuiListItemText-primary': {
                  color: theme.palette.common.black
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <IconButton size="small">
                  {expandedGroups.has(groupName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </IconButton>
              </ListItemIcon>
              <ListItemText primary={groupName} sx={{ color: theme.palette.common.black }} />
            </StyledListItem>
            <Collapse in={expandedGroups.has(groupName)} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {items.self && renderLabel(items.self, "group", 1, false)}
                {items.elevators.map(label => renderLabel(label, "elevators", 1))}
                {items.toilets.map(label => renderLabel(label, "toilets", 1))}
                {items.rooms.map(label => renderLabel(label, "rooms", 1))}
              </List>
            </Collapse>
          </Box>
        ))}
      </List>
    </StyledPaper>
  )
}

export default DropDownContainer
