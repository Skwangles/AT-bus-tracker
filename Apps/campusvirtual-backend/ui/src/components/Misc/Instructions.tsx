import React from 'react'
import '../../css/Instructions.css'
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  MousePointer,
  MapPin,
  Search,
  Map,
  User,
  LogOut,
  Circle,
  Square,
  RotateCcw,
  Info,
} from 'react-feather'

interface InstructionsProps {
  point: { keyframe_id: number; location: string; ts: string }
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  className?: string
}

const isMobile = () => window.innerWidth <= 768

const Instructions: React.FC<InstructionsProps> = ({
  point,
  isOpen,
  setIsOpen,
  className = '',
}) => {
  const mobile = isMobile()
  return (
    <div className={`stats-container ${className}`}>
      {isOpen && (
        <div className="stats">
          <h3 className="stats-heading">How to Navigate</h3>
          <ul className="instructions-list">
            {mobile ? (
              <>
                <li>
                  <MousePointer className="instruction-icon" />
                  <span>Drag or swipe to look around</span>
                </li>
              </>
            ) : (
              <>
                <li>
                  <span className="flex items-center gap-2">
                    <span className="key">W</span>
                    <span className="key">A</span>
                    <span className="key">S</span>
                    <span className="key">D</span>
                  </span>
                  <span>to move</span>
                </li>
                <li>
                  <span className="flex items-center gap-1">
                    <ArrowUp size={16} />
                    <ArrowLeft size={16} />
                    <ArrowDown size={16} />
                    <ArrowRight size={16} />
                  </span>
                  <span>to look around</span>
                </li>
                <li>
                  <MousePointer className="instruction-icon" />
                  <span>Drag to look around</span>
                </li>
              </>
            )}
            <li>
              <Circle className="instruction-icon" color="#ff4444" />
              <span>Click red orbs to jump to new locations</span>
            </li>
            <li>
              <MapPin className="instruction-icon" />
              <span>Your current location is shown just below the search bar at the top</span>
            </li>
          </ul>

          <h3 className="stats-heading">Search</h3>
          <ul className="instructions-list">
            <li>
              <Search className="instruction-icon" />
              <span>Use the search bar at the top to find locations</span>
            </li>
            <li>
              <Square className="instruction-icon" color="#ffd700" />
              <RotateCcw className="instruction-icon" color="#ffd700" />
              <span>Yellow rotating square marks your destination</span>
            </li>
            <li>
              <Circle className="instruction-icon" color="#4444ff" />
              <span>Blue path guides you to your destination</span>
            </li>
          </ul>

          <h3 className="stats-heading">Map</h3>
          <ul className="instructions-list">
            <li>
              <Map className="instruction-icon" />
              <span>Open the map with the button in the <b>top left</b></span>
            </li>
            <li>
              <div className="map-legend">
                <div className="legend-item">
                  <User className="instruction-icon" />
                  <span>Your position</span>
                </div>
                <div className="legend-item">
                  <LogOut className="instruction-icon" />
                  <span>Next region</span>
                </div>
                <div className="legend-item">
                  <Circle className="instruction-icon" color="#ff4444" />
                  <span>Viewing point</span>
                </div>
                <div className="legend-item">
                  <Circle className="instruction-icon" color="#4444ff" />
                  <span>Highlighted path</span>
                </div>
              </div>
            </li>
          </ul>

          <h3 className="stats-heading">Help</h3>
          <ul className="instructions-list">
            <li>
              <Info className="instruction-icon" />
              <span>Click the <b>Instructions</b> button in the <b>bottom right</b> to open or close this help window</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default Instructions
