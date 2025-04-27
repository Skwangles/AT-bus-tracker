import Instructions from "../Misc/Instructions";
import LocationChangeControls from "../Navigation/LocationChangeControls";
import { Label } from "../../types";

interface DesktopLayout {
  isMobile: boolean;
  currentPoint: any;
  allFloorNames: Label[];
  changeFloor: any;
  changeFloorUpOrDown: any;
  canGoDown: boolean;
  canGoUp: boolean;
  locationGroup: string;
  isInstructionsOpen: boolean;
  setInstructionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
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
  isLoading,
  isInstructionsOpen,
  setInstructionsOpen,
}) => {
  return (
    <>
      {!isMobile && (
        <>
          {/* Loading indicator */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

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
  );
};
