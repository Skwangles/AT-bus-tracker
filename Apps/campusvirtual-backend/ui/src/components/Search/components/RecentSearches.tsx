import React from 'react'
import { Label } from '../../../types'
import { getLabelDisplayName, getLabelIcon, getLabelColor } from '../../../utils/labelUtils'

interface RecentSearchesProps {
  recentSearches: Label[]
  handleSuggestionClick: (suggestion: Label) => void
}

const RecentSearches: React.FC<RecentSearchesProps> = ({ recentSearches, handleSuggestionClick }) => {
  if (recentSearches.length === 0) return null;

  return (
    <div className="recent-searches">
      <h3 className="px-4 py-2 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
        Recent Searches
      </h3>
      {recentSearches.map((recent) => (
        <div
          key={recent.query}
          className={`suggestion-item flex items-center ${getLabelColor(recent)}`}
          onClick={() => handleSuggestionClick(recent)}
        >
          <span className="mr-2">{getLabelIcon(recent)}</span>
          <span>{getLabelDisplayName(recent)}</span>
        </div>
      ))}
    </div>
  )
}

export default RecentSearches 