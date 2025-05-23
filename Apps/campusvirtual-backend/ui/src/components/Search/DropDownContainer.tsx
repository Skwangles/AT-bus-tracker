import { useState, useEffect } from 'react'
import { Label, LabelType } from '../../types'
import { groupLabelsByFloor } from '../../utils/floorUtils'
import RecentSearches from './components/RecentSearches'
import FloorGroup from './components/FloorGroup'


export default function DropDownContainer({
  setIsFocused,
  dropdownRef,
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
}: {
  setIsFocused: (isFocused: boolean) => void
  dropdownRef: React.RefObject<HTMLDivElement>
  recentSearches: Label[]
  query: string
  suggestions: Label[]
  handleSuggestionClick: (suggestion: Label, hide?: boolean) => void
}) {
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null)
  const [floorGroups, setFloorGroups] = useState<ReturnType<typeof groupLabelsByFloor>>([])

  useEffect(() => {
    setFloorGroups(groupLabelsByFloor(suggestions))
  }, [suggestions])

  const toggleFloor = (floorName: string) => {
    if (query === '') {
      const floorLabel = suggestions.find(s => s.type === LabelType.Group && s.label === floorName)
      if (floorLabel) {
        handleSuggestionClick(floorLabel, false)
      }
    }
    setExpandedFloor(expandedFloor === floorName ? null : floorName)
  }

  return (
    <div
      tabIndex={0}
      className="dropdown-container"
      ref={dropdownRef}
      onKeyUp={(event) => {
        if (event.key === 'Escape') {
          setIsFocused(false)
        }
      }}
    >
      {!query && (
        <RecentSearches
          recentSearches={recentSearches}
          handleSuggestionClick={handleSuggestionClick}
        />
      )}

      {floorGroups.length > 0 && (
        <div className="suggestions" tabIndex={0}>
          <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Locations
          </h3>

          {floorGroups.map((floor) => (
            <FloorGroup
              key={floor.name}
              floor={floor}
              isExpanded={expandedFloor === floor.name}
              onToggle={() => toggleFloor(floor.name)}
              onItemClick={handleSuggestionClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
