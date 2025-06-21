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
      style={{
        color: '#000',
        background: '#fff',
        paddingLeft: indent ? 32 : undefined,
        cursor: 'pointer',
        transition: 'color 0.2s',
      }}
      onClick={onClick}
      onKeyDown={(event) => keyboardToClick(event, onClick)}
      onMouseOver={e => (e.currentTarget.style.color = '#000')}
      onFocus={e => (e.currentTarget.style.color = '#000')}
      onMouseOut={e => (e.currentTarget.style.color = '#000')}
      onBlur={e => (e.currentTarget.style.color = '#000')}
    >
      <div className="flex items-center">
        {icon}
        {label.label}
      </div>
    </div>
  )
}

export default LocationItem 