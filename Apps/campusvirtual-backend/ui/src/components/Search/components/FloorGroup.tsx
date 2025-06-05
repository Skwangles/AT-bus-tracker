import React from 'react'
import { Label, LabelType } from '../../../types'
import { getLabelDisplayName, getLabelIcon, getLabelColor } from '../../../utils/labelUtils'
import { Search } from 'react-feather'

interface FloorGroupProps {
  floor: {
    name: string;
    items: {
      self: Label | null,
      rooms: Label[];
      elevators: Label[];
      toilets: Label[];
    };
  }
  isExpanded: boolean
  onToggle: () => void
  onItemClick: (label: Label) => void
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
  console.log("Floor:", floor)

  const handleFloorClick = (event: React.MouseEvent) => {
    // Create a floor label for searching
    const floorLabel: Label = {
      type: LabelType.GroupName,
      label: floor.name,
      query: floor.name,
      parents: [],
      children: [],
      coordinates: { x: 0, y: 0, z: 0 }
    }
    onItemClick(floorLabel)
  }

  const displayName = toTitleCase(floor.name)

  const renderLabel = (label: Label) => (
    <div
      key={label.parents.join('.') + label.query}
      className={`suggestion-item flex items-center ${getLabelColor(label)}`}
      onClick={() => onItemClick(label)}
    >
      <span className="mr-2">{getLabelIcon(label)}</span>
      <span>{getLabelDisplayName(label)}</span>
    </div>
  );

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
    <div className="floor-group">
      <div
        className="floor-header flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <span className="font-medium">{displayName}</span>
        <span className="text-gray-500">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      {isExpanded && (
        <div className="floor-items">
          {floor.items.rooms.map(renderLabel)}
          {floor.items.elevators.map(renderLabel)}
          {floor.items.toilets.map(renderLabel)}
        </div>
      )}
    </div>
  )
}

export default FloorGroup 