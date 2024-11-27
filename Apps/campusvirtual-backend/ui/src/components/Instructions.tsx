import React from 'react'
import '../css/Instructions.css'
import { Info, X } from 'react-feather'

interface InstructionsProps {
  point: { keyframe_id: number; location: string; ts: string }
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  className?: string
  showToggle?: boolean
}

const Instructions: React.FC<InstructionsProps> = ({
  point,
  isOpen,
  setIsOpen,
  className = '',
  showToggle = true,
}) => {
  return (
    <div className={`stats-container ${className}`}>
      {showToggle && (
        <button
          className={`stat-drawer-toggle ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={20} /> : <Info size={20} />}
          <span className="ml-2">{isOpen ? 'Close' : 'Help'}</span>
        </button>
      )}

      {isOpen && (
        <div className="stats">
          <h3 className="stats-heading">General Usage</h3>
          <ul>
            <li>Drag on the screen to move where you are looking</li>
            <li>Click on the Red orbs to jump to a different position</li>
            <li>
              The current region/location you are in is show in the bottom left
            </li>
          </ul>
          <h3 className="stats-heading">Search</h3>
          <ul>
            <li>
              Search for a region/location in the search bar and jump to it
              directly, or have it highlight the path in blue and guide you!
            </li>
            <li>
              The end of a highlighted path is shown with a yellow rotating
              square!
            </li>
            <li>
              Clear a highlighted path using a button in the top right (only
              shows when a path is highlighted)
            </li>
          </ul>
          <h3 className="stats-heading">Map</h3>
          <ul>
            <li>Toggle the map with a button in the top left</li>
            <li>Hover over the map to increase its size</li>
            <li>
              Map Key: Person Icon = Your Current position, Door Icon= Move to
              next the region, Red= Regular viewing point, Blue = A highlighted
              path
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default Instructions
