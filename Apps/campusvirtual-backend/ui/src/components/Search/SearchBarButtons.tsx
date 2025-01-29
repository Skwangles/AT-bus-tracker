import { Eye, ArrowUpRight } from 'react-feather'
import { Label } from '../../consts'

const includesValue = (data: Label[], value: string) => {
  console.log('Checking if contains', value, data)
  return data.find((val) => {
    const result =
      (val.group ? val.group.toLowerCase() + ' - ' : '') +
        val.label?.toLowerCase() ==
        value.toLowerCase() || val.label?.toLowerCase() === value.toLowerCase()
    console.log(result)

    return result
  })
}

export default function SearchBarButtons({ handleAction, query, labels }) {
  return (
    <div className="flex w-full gap-2 mt-2">
      <button
        onClick={() => handleAction(query, 'highlight')}
        disabled={!includesValue(labels, query)}
        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        aria-label="Highlight location"
      >
        <Eye size={14} aria-hidden="true" /> Guide
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
