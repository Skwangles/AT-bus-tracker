import { Eye, ArrowUpRight, MapPin, X } from 'react-feather'
import { Label } from '../../consts'
import { getLabelLongName } from '../../utils/labelUtils'

const includesValue = (data: Label[], value: string) => {
  return data.find((val) => {
    const result =
      getLabelLongName(val.group, val.label).toLowerCase() ==
        value.toLowerCase() || val.label?.toLowerCase() === value.toLowerCase()

    return result
  })
}

export default function SearchBarButtons({
  currentPoint,
  handleAction,
  query,
  labels,
  isPathfindingMode,
}) {
  return (
    <div className="flex w-full gap-2 mt-2">
      <div
        className={`bg-[#10101090] backdrop-blur-sm cursor-default text-white px-4 py-2 shadow-lg flex items-center gap-2 ${'rounded-xl'}`}
        style={{
          bottom: '1rem', // Adjust to align with drawer
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <MapPin className="w-5 h-5 text-blue-400" />
        <span>{currentPoint.location}</span>
      </div>
      <button
        onClick={() =>
          isPathfindingMode
            ? handleAction('', 'highlight') // Clear path
            : handleAction(query, 'highlight')
        }
        disabled={!includesValue(labels, query)}
        className={` ${
          isPathfindingMode ? 'bg-red-500' : 'bg-blue-500'
        } flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white  rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors`}
        aria-label="Highlight path to location"
      >
        {isPathfindingMode ? (
          <X size={14} aria-hidden="true" />
        ) : (
          <Eye size={14} aria-hidden="true" />
        )}

        {isPathfindingMode ? 'Clear Path' : 'Guide'}
      </button>
      <button
        onClick={() => handleAction(query, 'jump')}
        disabled={!includesValue(labels, query)}
        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        aria-label="Go to location"
      >
        <ArrowUpRight size={14} aria-hidden="true" /> Go To
      </button>
    </div>
  )
}
