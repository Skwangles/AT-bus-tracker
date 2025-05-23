import { ArrowDown, ArrowUp } from 'react-feather'

export const LocationChangeControls = ({
  canGoUp,
  canGoDown,
  changeLevelUpOrDown,
  locationGroup,
}: {
  canGoUp: boolean
  canGoDown: boolean
  changeLevelUpOrDown: (locationGroup: string, up: boolean) => void
  locationGroup: string
  allLocationNames: string[]
  changeLocation: (location: string) => void
}) => {
  return (
    <div className="flex flex-col items-center space-y-2 md:flex-row md:space-y-0 md:space-x-2">
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg shadow-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:bg-opacity-50 disabled:cursor-not-allowed"
        disabled={!canGoUp}
        onClick={() => changeLevelUpOrDown(locationGroup, true)}
      >
        <ArrowUp size={16} />
        <span>Level Up</span>
      </button>
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg shadow-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:bg-opacity-50 disabled:cursor-not-allowed"
        disabled={!canGoDown}
        onClick={() => changeLevelUpOrDown(locationGroup, false)}
      >
        <ArrowDown size={16} />
        <span>Level Down</span>
      </button>
    </div>
  )
}

export default LocationChangeControls
