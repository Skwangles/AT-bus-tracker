import { useState, useEffect } from 'react'
import { Label } from '../../consts'
import { ChevronDown, ChevronUp } from 'react-feather'

function sortWithGbeforeNumbers(a, b): number {
  const aLabel = String(a).toLowerCase().trim()
  const bLabel = String(b).toLowerCase().trim()
  if (aLabel.startsWith('g') && bLabel.startsWith('g')) {
    return aLabel.localeCompare(bLabel)
  } else if (aLabel.startsWith('g')) {
    return -1
  } else if (bLabel.startsWith('g')) {
    return -1
  } else {
    return aLabel.localeCompare(bLabel)
  }
}

export default function DropDownContainer({
  dropdownRef,
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
}: {
  dropdownRef: React.RefObject<HTMLDivElement>
  recentSearches: Label[]
  query: string
  suggestions: Label[]
  handleSuggestionClick: (suggestion: Label) => void
}) {
  const [expandedFloor, setExpandedFloor] = useState(null)
  const [displaySuggestions, setDisplaySuggestions] = useState({})

  const toggleFloor = (floorLabel) => {
    setExpandedFloor(expandedFloor === floorLabel ? null : floorLabel)
  }

  useEffect(() => {
    // Group the labels by their group and sort them alphabetically within each group
    const groupedLabels = suggestions.reduce((acc, label) => {
      const group = label.group
        ? label.group.trim().toLowerCase()
        : label.label.trim().toLowerCase()
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(label)
      return acc
    }, {})
    // Sort the labels within each group alphabetically
    const sortedGroupedLabels = Object.keys(groupedLabels).reduce(
      (acc, key) => {
        acc[key] = groupedLabels[key].sort((a, b) =>
          a.label.localeCompare(b.label)
        )
        return acc
      },
      {}
    )
    setDisplaySuggestions(sortedGroupedLabels || {})
  }, [suggestions])

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      {!query && recentSearches.length > 0 && (
        <div className="recent-searches mb-2">
          <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Recent Searches
          </h3>
          {recentSearches.map((recent, index) => (
            <div
              key={`recent-${index}`}
              className="suggestion-item cursor-pointer hover:text-blue-500"
              onClick={() => handleSuggestionClick(recent)}
            >
              {(recent.group ? recent.group + ' - ' : '') + recent.label}
            </div>
          ))}
        </div>
      )}

      {Object.keys(displaySuggestions).length > 0 && (
        <div className="suggestions">
          <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Suggestions
          </h3>

          {Object.keys(displaySuggestions)
            .sort(sortWithGbeforeNumbers)
            .map((suggestion, index) => {
              const parentLabel = displaySuggestions[suggestion].find(
                (label) => String(label.label).toLowerCase() === suggestion
              )

              return (
                <>
                  {parentLabel && (
                    // This part is for the floors (Parent Labels)
                    <div
                      key={index}
                      className="suggestion-item cursor-pointer hover:text-blue-500"
                      onClick={() => toggleFloor(parentLabel.label)}
                    >
                      <div className="flex items-center">
                        <b>{parentLabel?.label}</b>
                        {expandedFloor === parentLabel.label ? (
                          <ChevronUp className="ml-2 h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="ml-2 h-5 w-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                  )}

                  {expandedFloor === parentLabel?.label &&
                    // This part shows the rooms (Child Labels) when the floor is expanded
                    displaySuggestions[suggestion].map((label) =>
                      label.query === parentLabel?.query ? null : (
                        <div
                          key={label.query}
                          className="suggestion-item cursor-pointer hover:text-blue-500"
                          onClick={() => handleSuggestionClick(label)}
                        >
                          {parentLabel && '• '}
                          {label.label}
                        </div>
                      )
                    )}

                  {!parentLabel && (
                    // This part is for items like "Elevator" or "Toilet"
                    <div key={index} className="suggestion-item">
                      <b>{displaySuggestions[suggestion][0]?.group}</b>
                    </div>
                  )}
                </>
              )
            })}
        </div>
      )}
    </div>
  )
}
