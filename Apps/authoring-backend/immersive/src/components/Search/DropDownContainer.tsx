import { useState, useEffect } from 'react'
import { Label, LabelType } from '../../consts'
import { ChevronDown, ChevronLeft } from 'react-feather'
import { getLabelLongName } from '../../utils/labelUtils'

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

const keyboardToClick = (event, callback) => {
  if (event.key === 'Enter' || event.key === ' ') {
    callback()
  }
}

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
  const [expandedFloor, setExpandedFloor] = useState(null)
  const [displaySuggestions, setDisplaySuggestions] = useState({})

  const toggleFloor = (floorLabel) => {
    if (query === '') {
      handleSuggestionClick(floorLabel, false)
    }
    setExpandedFloor(
      expandedFloor === floorLabel?.label ? null : floorLabel?.label
    )
  }

  useEffect(() => {
    // 1. Populate top level group names
    const dict = {}
    for (const val of suggestions) {
      if (val.type == LabelType.Group) {
        dict[val.label.trim().toLowerCase()] = [val]
      } else if (val.type == LabelType.Elevator) {
        dict[val.group!.trim().toLowerCase() ?? 'elevator'] = [val]
      }
    }

    const groupedLabels = { ...dict }
    for (const label of suggestions) {
      if (label.type == LabelType.Group) {
        continue
      }

      const group = label.group!.trim().toLowerCase()
      if (groupedLabels[group]) {
        groupedLabels[group].push(label)
      } else {
        groupedLabels[group] = [
          {
            // If doesn't exist, keep the high level
            query: label.group,
            label: label.group,
            group: null,
            type: LabelType.Group,
          },
          label,
        ]
      }
    }

    setDisplaySuggestions(groupedLabels ?? {})
  }, [suggestions])

  return (
    <div
      tabIndex={0}
      className="dropdown-container"
      ref={dropdownRef}
      onKeyUp={(event) => {
        if (event.key == 'Escape') {
          setIsFocused(false)
        }
      }}
    >
      {!query && recentSearches.length > 0 && (
        <div className="recent-searches mb-2" tabIndex={0}>
          <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Recent Searches
          </h3>
          {recentSearches.map((recent, index) => (
            <div
              key={`recent-${index}`}
              className="suggestion-item cursor-pointer hover:text-blue-500"
              onClick={() => handleSuggestionClick(recent)}
            >
              {getLabelLongName(recent.group, recent.label)}
            </div>
          ))}
        </div>
      )}

      {Object.keys(displaySuggestions).length > 0 && (
        <div key={'suggestions-header'} className="suggestions" tabIndex={0}>
          <h3
            key={'h3 suggestions'}
            className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50"
          >
            Suggestions
          </h3>

          {Object.keys(displaySuggestions)
            .sort(sortWithGbeforeNumbers)
            .map((suggestion, index) => {
              const parentLabel = displaySuggestions[suggestion][0]
              const hasMultiple = displaySuggestions[suggestion].length > 1
              return (
                <>
                  {parentLabel && (
                    // This part is for the floors (Parent Labels)
                    <div
                      role="button"
                      tabIndex={0}
                      key={index + 'parent'}
                      className="suggestion-item cursor-pointer hover:text-blue-500"
                      onClick={() => toggleFloor(parentLabel)}
                      onKeyDown={(event) =>
                        keyboardToClick(event, () => toggleFloor(parentLabel))
                      }
                    >
                      <div className="flex items-center">
                        <b>
                          {parentLabel.type == LabelType.Elevator // Elevators don't have a top level floor label (e.g. outdoors, Level 1, etc.), so get the first label's 'group' name
                            ? parentLabel.group
                            : parentLabel?.label}
                        </b>

                        {hasMultiple ? (
                          expandedFloor === parentLabel.label ? (
                            <ChevronDown className="ml-2 h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronLeft className="ml-2 h-5 w-5 text-gray-500" />
                          )
                        ) : (
                          <></>
                        )}
                      </div>
                    </div>
                  )}

                  {expandedFloor === parentLabel?.label &&
                    // This part shows the rooms (Child Labels) when the floor is expanded
                    displaySuggestions[suggestion].map((label, idx) =>
                      (label.query === parentLabel?.query &&
                        label.type !== LabelType.Elevator) ||
                      (label.type == LabelType.Elevator && idx == 0) ? null : (
                        <div
                          role="button"
                          tabIndex={0}
                          key={'expanded' + label.query + idx}
                          className="suggestion-item cursor-pointer hover:text-blue-500"
                          onClick={() => handleSuggestionClick(label)}
                          onKeyDown={(event) =>
                            keyboardToClick(event, () =>
                              handleSuggestionClick(label)
                            )
                          }
                        >
                          {parentLabel && '• '}
                          {label.label}
                        </div>
                      )
                    )}
                </>
              )
            })}
        </div>
      )}
    </div>
  )
}
