import React from 'react'
import { Label } from '../../../types'
import { getLabelLongName } from '../../../utils/labelUtils'

interface RecentSearchesProps {
  recentSearches: Label[]
  handleSuggestionClick: (suggestion: Label) => void
}

const RecentSearches: React.FC<RecentSearchesProps> = ({ recentSearches, handleSuggestionClick }) => {
  if (!recentSearches.length) return null;

  return (
    <div className="recent-searches mb-2" tabIndex={0}>
      <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
        Recent Searches
      </h3>
      {recentSearches.map((recent, index) => (
        <div
          key={`recent-${index}`}
          className="suggestion-item cursor-pointer hover:text-blue-500"
          onClick={() => handleSuggestionClick(recent)}
        >
          {getLabelLongName(recent.group, recent.label)}
        </div>
      ))}
    </div>
  )
}

export default RecentSearches 