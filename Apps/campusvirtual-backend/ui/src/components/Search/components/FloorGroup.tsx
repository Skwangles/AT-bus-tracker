import React from 'react'
import { Label, LabelType } from '../../../types'
import { ChevronDown, ChevronLeft, ArrowUp, Coffee, Search } from 'react-feather'
import { groupLabelsByFloor } from '../../../utils/floorUtils'
import LocationItem from './LocationItem'

interface FloorGroupProps {
  floor: ReturnType<typeof groupLabelsByFloor>[0]
  isExpanded: boolean
  onToggle: () => void
  onItemClick: (label: Label) => void
}

const keyboardToClick = (event: React.KeyboardEvent, callback: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    callback()
  }
}

const toTitleCase = (str: string): string => {
  return str.toLowerCase().split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const FloorGroup: React.FC<FloorGroupProps> = ({ floor, isExpanded, onToggle, onItemClick }) => {
  // Skip rendering if the floor name ends with '- staircase'
  if (floor.name.toLowerCase().endsWith('- staircase')) {
    return null
  }

  const hasItems = floor.items.rooms.length > 0 || 
                  floor.items.elevators.length > 0 || 
                  floor.items.toilets.length > 0;

  const handleFloorClick = (event: React.MouseEvent) => {
    // Create a floor label for searching
    const floorLabel: Label = {
      type: LabelType.Group,
      group: 'Floor',
      label: floor.name,
      query: floor.name
    }
    onItemClick(floorLabel)
  }

  const displayName = toTitleCase(floor.name)

  // Debug: log elevator items for this floor
  console.log('Elevators for', floor.name, floor.items.elevators)

  if (!hasItems) {
    return (
      <div className="suggestion-item">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <b>{displayName}</b>
          </div>
          <button
            className="p-1 hover:text-blue-500 focus:outline-none"
            onClick={handleFloorClick}
            title={`Search for ${displayName}`}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className="suggestion-item cursor-pointer hover:text-blue-500"
        onClick={onToggle}
        onKeyDown={(event) => keyboardToClick(event, onToggle)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <b>{displayName}</b>
            {isExpanded ? (
              <ChevronDown className="ml-2 h-5 w-5 text-gray-500" />
            ) : (
              <ChevronLeft className="ml-2 h-5 w-5 text-gray-500" />
            )}
          </div>
          <button
            className="p-1 hover:text-blue-500 focus:outline-none"
            onClick={(e) => {
              e.stopPropagation()
              handleFloorClick(e)
            }}
            title={`Search for ${displayName}`}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {floor.items.rooms.map((room, idx) => (
            <LocationItem
              key={`room-${idx}`}
              label={room}
              onClick={() => onItemClick(room)}
              indent
            />
          ))}

          {floor.items.elevators.map((elevator, idx) => (
            <LocationItem
              key={`elevator-${idx}`}
              label={{
                ...elevator,
                label: elevator.label.split('-').slice(1).join('-').trim() || 'Elevator'
              }}
              onClick={() => onItemClick(elevator)}
              icon={<ArrowUp className="h-4 w-4 mr-2 text-gray-500" />}
              indent
            />
          ))}

          {floor.items.toilets.map((toilet, idx) => (
            <LocationItem
              key={`toilet-${idx}`}
              label={toilet}
              onClick={() => onItemClick(toilet)}
              icon={<Coffee className="h-4 w-4 mr-2 text-gray-500" />}
              indent
            />
          ))}
        </>
      )}
    </div>
  )
}

export default FloorGroup 