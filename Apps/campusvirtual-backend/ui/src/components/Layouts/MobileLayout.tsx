import { MapPin, ChevronUp, Info } from 'react-feather'
import Instructions from '../Misc/Instructions'
import LocationChangeControls from '../Navigation/LocationChangeControls'
import { useState, useEffect, useRef } from 'react'
import { Label } from '../../types'

interface MobileLayout {
  isMobile: boolean
  currentPoint: any
  allFloorNames: Label[]
  changeFloor: any
  changeFloorUpOrDown: any
  canGoDown: boolean
  canGoUp: boolean
  locationGroup: string
  isInstructionsOpen: boolean
  setInstructionsOpen: any
}

export const MobileLayout: React.FC<MobileLayout> = ({
  isMobile,
  currentPoint,
  allFloorNames,
  changeFloor,
  changeFloorUpOrDown,
  canGoDown,
  canGoUp,
  locationGroup,
  isInstructionsOpen,
  setInstructionsOpen,
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    if (isMobile && !showMobileMenu) {
      setInstructionsOpen(false)
    }
  }, [isMobile, showMobileMenu])

  const drawerRef = useRef<HTMLDivElement>(null)

  const [drawerHeight, setDrawerHeight] = useState(0)

  useEffect(() => {
    if (drawerRef.current) {
      setDrawerHeight(drawerRef.current.scrollHeight)
    }
  }, [showMobileMenu])

  return (
    <>
      {isMobile && (
        <>
          {/* Location indicator with chevron */}
          <div
            className={`fixed left-1/2 -translate-x-1/2 z-[999] bg-[#101010F0] text-white px-4 py-2 shadow-lg flex items-center gap-2 cursor-pointer ${
              showMobileMenu ? 'rounded-t-xl' : 'rounded-xl'
            }`}
            style={{
              bottom: showMobileMenu ? `${drawerHeight}px` : '1rem', // Adjust to align with drawer
              transition: 'all 0.3s ease-in-out',
            }}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <MapPin className="w-5 h-5" />
            <span>You are in: {currentPoint.location}</span>
            <ChevronUp
              className={`w-5 h-5 transition-transform duration-300 ${
                showMobileMenu ? 'rotate-180' : ''
              }`}
            />
          </div>

          {/* Slide-up drawer */}
          <div
            ref={drawerRef}
            className={`fixed left-1/2 -translate-x-1/2 bg-[#101010F0] text-white shadow-lg transition-all duration-300 ease-in-out ${
              showMobileMenu ? 'rounded-b-xl' : 'rounded-xl'
            }`}
            style={{
              bottom: showMobileMenu ? '0' : `-${drawerHeight}px`, // Use negative height to hide the drawer completely
              width: '90%', // Match the width of the location indicator
              maxHeight: '70vh', // Set a max height to prevent overflow
              overflowY: 'auto', // Allow scrolling if content exceeds max height
              transition: 'all 0.3s ease-in-out',
              zIndex: 998,
            }}
          >
            <div className="p-4 space-y-4">
              {/* Floor controls */}
              <div className="border-t border-gray-700 pt-4">
                <LocationChangeControls
                  canGoUp={canGoUp}
                  canGoDown={canGoDown}
                  changeFloorUpOrDown={changeFloorUpOrDown}
                  locationGroup={locationGroup}
                  allFloorNames={allFloorNames.map((v) => v.query)}
                  changeFloor={changeFloor}
                />
              </div>
            </div>
          </div>

          {/* Instructions */}
          {isInstructionsOpen && (
            <Instructions
              point={currentPoint}
              isOpen={isInstructionsOpen}
              setIsOpen={setInstructionsOpen}
              className="mobile-instructions"
              showToggle={true}
            />
          )}
          {/* Instructions button */}
          <button
            className="fixed bottom-4 right-4 z-[1001] bg-white/90 hover:bg-white rounded-full p-3 shadow-lg flex items-center justify-center"
            onClick={() => setInstructionsOpen(!isInstructionsOpen)}
          >
            <Info className="w-5 h-5 text-black" />
          </button>
        </>
      )}
    </>
  )
}
