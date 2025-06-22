import React from 'react'
import { Map as FeatherMap, X, Search } from 'react-feather'
import Fab from '@mui/material/Fab'

interface FloatingActionButtonsProps {
  showMap: boolean
  hasImage: boolean
  isMapOpen: boolean
  isMobile: boolean
  onMapClick: () => void
  onSearchClick: () => void
}

const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  showMap,
  hasImage,
  isMapOpen,
  isMobile,
  onMapClick,
  onSearchClick
}) => {
  return (
    <>
      {/* Search Floating Action Button (FAB) */}
      <Fab
        color="primary"
        aria-label="search"
        style={{
          position: 'fixed',
          bottom: isMobile ? '140px' : '80px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#E5F3F3',
          color: '#1B1B1E',
        }}
        onClick={onSearchClick}
      >
        <Search />
      </Fab>

      {/* Map Floating Action Button (FAB) */}
      {showMap && (
        <Fab
          color="primary"
          aria-label="map"
          style={{
            position: 'fixed',
            bottom: isMobile ? '80px' : '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: hasImage ? 'white' : '#e0e0e0',
            color: hasImage ? 'black' : '#9e9e9e',
            opacity: hasImage ? 1 : 0.7,
          }}
          onClick={onMapClick}
          disabled={!hasImage}
        >
          {isMapOpen && !isMobile ? <X /> : <FeatherMap />}
        </Fab>
      )}
    </>
  )
}

export default FloatingActionButtons 