import Instructions from "../Misc/Instructions";
import LocationChangeControls from "../Navigation/LocationChangeControls";
import { Label, PointData } from "../../types";

interface DesktopLayoutProps {
  isMobile: boolean;
  currentPoint: PointData;
  allFloorNames: Label[];
  changeLocation: any;
  changeLevelUpOrDown: any;
  canGoDown: boolean;
  canGoUp: boolean;
  isLoading: boolean;
  locationGroup: string;
  isInstructionsOpen: boolean;
  setInstructionsOpen: (isOpen: boolean) => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  isMobile,
  currentPoint,
  allFloorNames,
  changeLocation,
  changeLevelUpOrDown,
  canGoDown,
  canGoUp,
  isLoading,
  locationGroup,
  isInstructionsOpen,
  setInstructionsOpen,
}) => {
  return (
    <div className="hidden md:block">
      <div className="fixed top-4 right-4 z-[999]">
        <LocationChangeControls
          canGoUp={canGoUp}
          canGoDown={canGoDown}
          changeLevelUpOrDown={changeLevelUpOrDown}
          locationGroup={locationGroup}
          allLocationNames={allFloorNames.map((v) => v.query)}
          changeLocation={changeLocation}
        />
      </div>
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

          <Instructions
            point={currentPoint}
            isOpen={isInstructionsOpen}
            setIsOpen={setInstructionsOpen}
            className="desktop-instructions"
            showToggle={true}
          />
        </>
      )}
    </div>
  );
};
