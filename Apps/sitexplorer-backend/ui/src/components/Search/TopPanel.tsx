import { Label, PointData } from "../../types"
import CurrentLocation from "./CurrentLocation"
import MenuIcon from '@mui/icons-material/Menu'
import ClearPathfindingButton from "../Navigation/ClearPathfindingButton"
import SearchBar from "./SearchBar"
import { toast } from "react-toastify"
import { getLabelLongName } from "../../utils/labelUtils"
import { useTranslation } from "react-i18next"

interface TopPanelProps {
    currentPoint: PointData
    isSearchOpen: boolean
    setIsSearchOpen: (isSearchOpen: boolean) => void
    setDrawerOpen: (isDrawerOpen: boolean) => void
    searchToggleRef: React.RefObject<HTMLDivElement>
    searchContainerRef: React.RefObject<HTMLDivElement>
    allSearchableLocations: Label[]
    highlightedPath: number[]
    handleClearPath: () => void
    isMobile: boolean
    calculateHighlightedPath: (selected: string, displayLabel?: string) => void
    handleSuggestionClick: (label: Label, isJumpTo: boolean) => void
}

    export default function TopPanel({
    currentPoint,
    isSearchOpen,
    setIsSearchOpen,
    setDrawerOpen,
    searchToggleRef,
    searchContainerRef,
    allSearchableLocations,
    highlightedPath,
    handleClearPath,
    isMobile,
    calculateHighlightedPath,
    handleSuggestionClick,
}: TopPanelProps) { 
    const { t } = useTranslation('common')

    return (
        <>
        <div className="fixed top-0 left-0 right-0 z-[999] p-4 flex items-center justify-between">
          {/* Spacer to balance the menu button on the right */}
          <div style={{ width: '48px' }} />

          {/* Centered Container for Location and Search */}
          <div ref={searchToggleRef}>
            <CurrentLocation
              location={currentPoint.location}
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              isOpen={isSearchOpen}
            />
          </div>

          {/* Menu Button (Hamburger) */}
          <button
            className="flex items-center justify-center rounded-full shadow-lg"
            style={{ background: '#E5F3F3', color: '#1B1B1E', border: 'none', width: '48px', height: '48px' }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon style={{ fontSize: 32 }} />
          </button>
        </div>

        {/* Clear Pathfinding Button */}
        <ClearPathfindingButton
          showButton={highlightedPath.length > 0}
          handleClearPath={handleClearPath}
        />

        {isSearchOpen && (
          <div 
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[998] w-full max-w-md px-4" 
            ref={searchContainerRef}
            style={{
              top: isMobile ? '80px' : 'calc(2rem + 24px)',
              left: isMobile ? '50%' : '50%',
              transform: isMobile ? 'translateX(-50%)' : 'translateX(-50%)',
            }}
          >
            <SearchBar
              currentPoint={currentPoint}
              searchableLabels={allSearchableLocations}
              jumpToCallback={(selected) => {
                const label = allSearchableLocations.find(l => l.query === selected || getLabelLongName(l) === selected);
                if (label) {
                  handleSuggestionClick(label, true)
                } else {
                  console.error("Could not find label for query:", selected);
                  toast.error(t('location.navigate.error', 'Could not navigate to location.'));
                }
              }}
              highlightCallback={calculateHighlightedPath}
              onClose={() => setIsSearchOpen(false)}
            />
          </div>
        )}

        </>
    )
}