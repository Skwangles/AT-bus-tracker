import React from 'react'
import { Label } from '../../../types'

interface LocationItemProps {
  label: Label
  onClick: () => void
  icon?: React.ReactNode
  indent?: boolean
}

const keyboardToClick = (event: React.KeyboardEvent, callback: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    callback()
  }
}

const LocationItem: React.FC<LocationItemProps> = ({ label, onClick, icon, indent = false }) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`suggestion-item cursor-pointer hover:text-blue-500 ${indent ? 'pl-4' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => keyboardToClick(event, onClick)}
    >
      <div className="flex items-center">
        {icon}
        {label.label}
      </div>
    </div>
  )
}

export default LocationItem 