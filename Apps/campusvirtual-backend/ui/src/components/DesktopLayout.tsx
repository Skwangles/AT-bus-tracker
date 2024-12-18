import { MapPin } from "react-feather"
import Instructions from "./Instructions"
import LocationChangeControls from "./LocationChangeControls"

interface DesktopLayout {
    isMobile: boolean
    currentPoint: any
    setCurrentPoint: any
    allFloorNames: string[]
    changeFloor: any
    changeFloorUpOrDown: any
    canGoDown: boolean
    canGoUp: boolean
    locationGroup: string
    isInstructionsOpen: boolean
    setInstructionsOpen: any
}

export const DesktopLayout: React.FC<DesktopLayout> = ({isMobile, currentPoint, setCurrentPoint, allFloorNames, changeFloor, changeFloorUpOrDown, canGoDown, canGoUp, locationGroup, isInstructionsOpen, setInstructionsOpen}) => {      
      
    return <>
    {!isMobile && (
    <>
        <div className="fixed left-0 bottom-0 z-[999] m-4">
        <div className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-black/90 text-white backdrop-blur-sm shadow-lg transition-all">
            <MapPin className="w-6 h-6 text-blue-400" aria-hidden="true" />
            <span className="truncate">
            You are in:{' '}
            <span className="text-blue-400">{currentPoint.location}</span>
            </span>
        </div>
        </div>

        {/* Position LocationChangeControls in the bottom right */}
        <div className="fixed right-0 bottom-0 z-50 m-4">
        <LocationChangeControls
            canGoUp={canGoUp}
            canGoDown={canGoDown}
            changeFloorUpOrDown={changeFloorUpOrDown}
            locationGroup={locationGroup}
            allFloorNames={allFloorNames}
            changeFloor={changeFloor}
        />
        </div>

        <Instructions
        point={currentPoint}
        isOpen={isInstructionsOpen}
        setIsOpen={setInstructionsOpen}
        className="desktop-instructions"
        showToggle={true}
        />
    </>
    )}
    </>
}
