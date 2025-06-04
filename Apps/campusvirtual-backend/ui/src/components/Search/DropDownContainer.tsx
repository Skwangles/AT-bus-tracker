import React, { useState, useMemo } from 'react'
import { Label, LabelType } from '../../types'
import { getLabelDisplayName, getLabelIcon, getLabelColor } from '../../utils/labelUtils'
import { ChevronDown, ChevronRight, ArrowUp, User } from 'react-feather'

interface DropDownContainerProps {
  setIsFocused: (isFocused: boolean) => void
  dropdownRef: React.RefObject<HTMLDivElement>
  recentSearches: Label[]
  query: string
  suggestions: Label[]
  handleSuggestionClick: (suggestion: Label, hide?: boolean) => void
}

const DropDownContainer: React.FC<DropDownContainerProps> = ({
  setIsFocused,
  dropdownRef,
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
}) => {
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
    const groups: { [key: string]: { rooms: Label[], elevators: Label[], toilets: Label[] } } = {}
    
    suggestions.forEach(label => {
      // Skip staircase groups
      if (label.label.toLowerCase().endsWith('- staircase')) return

      const floorName = label.parents[0] || 'Other'
      if (!groups[floorName]) {
        groups[floorName] = { rooms: [], elevators: [], toilets: [] }
      }

      // Categorize labels by type
      switch (label.type) {
        case LabelType.Normal:
          groups[floorName].rooms.push(label)
          break
        case LabelType.Toilet:
          groups[floorName].toilets.push(label)
          break
        case LabelType.Elevator:
          groups[floorName].elevators.push(label)
          break
      }
    })

    // Sort floors in order: B, G, 1, 2, 3, etc.
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'B') return -1
      if (b === 'B') return 1
      if (a === 'G') return -1
      if (b === 'G') return 1
      return parseInt(a) - parseInt(b)
    })
  }, [suggestions])

  const renderLabel = (label: Label, depth: number = 0) => {
    // Skip rendering children for elevators
    const hasChildren = label.type !== LabelType.Elevator && label.children && label.children.length > 0
    const isExpanded = expandedGroups.has(label.query)
    const color = getLabelColor(label)

    // Get the appropriate icon component
    const getIcon = () => {
      switch (label.type) {
        case LabelType.Elevator:
          return <ArrowUp className="h-4 w-4 mr-2" />
        case LabelType.Toilet:
          return <User className="h-4 w-4 mr-2" />
        default:
          return null
      }
    }

    return (
      <div key={label.query} style={{ paddingLeft: `${depth * 1.5}rem` }}>
        <div
          className={`suggestion-item flex items-center justify-between ${color}`}
          onClick={() => handleSuggestionClick(label)}
        >
          <div className="flex items-center">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleGroup(label.query)
                }}
                className="mr-2 p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            )}
            {getIcon()}
            <span>{getLabelDisplayName(label)}</span>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {label.children.map((child) => renderLabel(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={dropdownRef}
      className="dropdown-container"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setIsFocused(false)
        }
      }}
    >
      {!query && recentSearches.length > 0 && (
        <div className="recent-searches">
          <h3 className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Recent Searches
          </h3>
          {recentSearches.map((recent) => renderLabel(recent))}
        </div>
      )}

      <div className="suggestions">
        <h3 className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
          Suggestions
        </h3>
        
        {/* Render floor groups */}
        {groupedSuggestions.map(([floorName, items]) => (
          <div key={floorName} className="floor-group">
            <div
              className="floor-header flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleGroup(floorName)}
            >
              <span className="font-medium">Floor {floorName}</span>
              <span className="text-gray-500">
                {expandedGroups.has(floorName) ? '▼' : '▶'}
              </span>
            </div>
            {expandedGroups.has(floorName) && (
              <div className="floor-items">
                {/* Render elevators first */}
                {items.elevators.map(label => renderLabel(label, 1))}
                {/* Then toilets */}
                {items.toilets.map(label => renderLabel(label, 1))}
                {/* Finally rooms */}
                {items.rooms.map(label => renderLabel(label, 1))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DropDownContainer
