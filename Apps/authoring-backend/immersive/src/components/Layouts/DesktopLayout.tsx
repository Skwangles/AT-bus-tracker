import Instructions from '../Misc/Instructions'
import LocationChangeControls from '../Navigation/LocationChangeControls'
import { Label } from '../../consts'

interface DesktopLayout {
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

export const DesktopLayout: React.FC<DesktopLayout> = ({
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
  return (
    <>
      {!isMobile && (
        <>
          <div className="fixed right-0 bottom-0 z-50 m-4">
            <LocationChangeControls
              canGoUp={canGoUp}
              canGoDown={canGoDown}
              changeFloorUpOrDown={changeFloorUpOrDown}
              locationGroup={locationGroup}
              allFloorNames={allFloorNames.map((v) => v.query)}
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
  )
}
