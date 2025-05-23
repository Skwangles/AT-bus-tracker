import { MapPin, ChevronUp, Info } from "react-feather";
import Instructions from "../Misc/Instructions";
import LocationChangeControls from "../Navigation/LocationChangeControls";
import { useState, useEffect, useRef } from "react";
import { Label, PointData } from "../../types";

interface MobileLayoutProps {
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

export const MobileLayout: React.FC<MobileLayoutProps> = ({
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    if (isMobile && !showMobileMenu) {
      setInstructionsOpen(false);
    }
  }, [isMobile, showMobileMenu]);

  const drawerRef = useRef<HTMLDivElement>(null);

  const [drawerHeight, setDrawerHeight] = useState(0);

  useEffect(() => {
    if (drawerRef.current) {
      setDrawerHeight(drawerRef.current.scrollHeight);
    }
  }, [showMobileMenu]);

  return (
    <div className="md:hidden">
      <div className="fixed bottom-4 right-4 z-[999]">
        <LocationChangeControls
          canGoUp={canGoUp}
          canGoDown={canGoDown}
          changeLevelUpOrDown={changeLevelUpOrDown}
          locationGroup={locationGroup}
          allLocationNames={allFloorNames.map((v) => v.query)}
          changeLocation={changeLocation}
        />
      </div>
      {isMobile && (
        <>
          {/* Loading indicator */}
          {isLoading && (
            <div className="loading-spinner">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 shadow-lg">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          )}

          {/* Location indicator with chevron */}
          <div
            className={`fixed left-1/2 -translate-x-1/2 z-[999] bg-[#101010F0] text-white px-6 py-4 shadow-lg flex items-center gap-3 cursor-pointer ${
              showMobileMenu ? "rounded-t-xl" : "rounded-xl"
            }`}
            style={{
              bottom: showMobileMenu ? `${drawerHeight}px` : "1rem",
              transition: "all 0.3s ease-in-out",
              minHeight: "44px",
            }}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            role="button"
            aria-label="Toggle location menu"
            tabIndex={0}
          >
            <MapPin className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-medium">You are in: {currentPoint.location}</span>
            <ChevronUp
              className={`w-6 h-6 text-blue-400 transition-transform duration-300 ${
                showMobileMenu ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Slide-up drawer */}
          <div
            ref={drawerRef}
            className={`fixed left-1/2 -translate-x-1/2 bg-[#101010F0] text-white shadow-lg transition-all duration-300 ease-in-out ${
              showMobileMenu ? "rounded-b-xl" : "rounded-xl"
            }`}
            style={{
              bottom: showMobileMenu ? "0" : `-${drawerHeight}px`,
              width: "90%",
              maxHeight: "70vh",
              overflowY: "auto",
              transition: "all 0.3s ease-in-out",
              zIndex: 998,
            }}
          >
            <div className="p-6 space-y-6">
              {/* Floor controls */}
              <div className="border-t border-gray-700 pt-6">
                <LocationChangeControls
                  canGoUp={canGoUp}
                  canGoDown={canGoDown}
                  changeLevelUpOrDown={changeLevelUpOrDown}
                  locationGroup={locationGroup}
                  allLocationNames={allFloorNames.map((v) => v.query)}
                  changeLocation={changeLocation}
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
            className="fixed bottom-6 right-6 z-[1001] bg-white/90 hover:bg-white rounded-full p-4 shadow-lg flex items-center justify-center min-h-[44px] min-w-[44px]"
            onClick={() => setInstructionsOpen(!isInstructionsOpen)}
            aria-label="Toggle instructions"
          >
            <Info className="w-6 h-6 text-black" />
          </button>
        </>
      )}
    </div>
  );
};
