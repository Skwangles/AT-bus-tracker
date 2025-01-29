export default function DropDownContainer({
  dropdownRef,
  recentSearches,
  query,
  suggestions,
  handleSuggestionClick,
}) {
  return (
    <div className="dropdown-container" ref={dropdownRef}>
      {!query && recentSearches.length > 0 && (
        <div className="recent-searches">
          <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
            Recent Searches
          </h3>
          {recentSearches.map((recent, index) => (
            <div
              key={`recent-${index}`}
              className="suggestion-item cursor-pointer hover:text-blue-500"
              onClick={() => handleSuggestionClick(recent)}
            >
              {recent}
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestions">
          {query && (
            <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
              Suggestions
            </h3>
          )}
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="suggestion-item cursor-pointer hover:text-blue-500"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
