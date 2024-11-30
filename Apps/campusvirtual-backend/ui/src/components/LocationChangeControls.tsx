import { ArrowDown, ArrowUp, Sun } from 'react-feather'
import { OUTDOORS_LOCATION } from '../consts'

export const LocationChangeControls = ({
  canGoUp,
  canGoDown,
  changeFloorUpOrDown,
  locationGroup,
  allFloorNames,
  changeFloor,
}: {
  canGoUp: boolean
  canGoDown: boolean
  changeFloorUpOrDown: (locationGroup: string, up: boolean) => void
  locationGroup: string
  allFloorNames: string[]
  changeFloor: (floor: string) => void
}) => {
  return (
    <div className="flex flex-col items-center space-y-2 md:flex-row md:space-y-0 md:space-x-2">
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg shadow-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:bg-opacity-50 disabled:cursor-not-allowed"
        disabled={!canGoUp}
        onClick={() => changeFloorUpOrDown(locationGroup, true)}
      >
        <ArrowUp size={16} />
        <span>Floor Up</span>
      </button>
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg shadow-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:bg-opacity-50 disabled:cursor-not-allowed"
        disabled={!canGoDown}
        onClick={() => changeFloorUpOrDown(locationGroup, false)}
      >
        <ArrowDown size={16} />
        <span>Floor Down</span>
      </button>
      <button
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white transition-colors rounded-lg shadow-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:bg-opacity-50 disabled:cursor-not-allowed"
        disabled={!allFloorNames.includes(OUTDOORS_LOCATION)}
        onClick={() => changeFloor(OUTDOORS_LOCATION)}
      >
        <Sun size={16} />
        <span>Go Outdoors</span>
      </button>
    </div>
  )
}

export default LocationChangeControls
