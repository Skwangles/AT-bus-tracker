// src/SearchBar.tsx
import React, {
  useState,
  ChangeEvent,
  MouseEvent,
  useRef,
  useEffect,
} from 'react'
import '../css/SearchBar.css'
import { ArrowUpRight, Eye, X } from 'react-feather'
// Define the type for the props
interface SearchBarProps {
  data: string[]
  jumpToCallback: (selected: string) => void
  highlightCallback: (selected: string) => void
}

const IncludesValue = (data: string[], value: string) => {
  return data.find((val) => val.toLowerCase() == value.toLowerCase())
}

const SearchBar: React.FC<SearchBarProps> = ({
  data,
  jumpToCallback,
  highlightCallback,
}) => {
  const [query, setQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches')
    return saved ? JSON.parse(saved) : []
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside as any)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as any)
    }
  }, [])

  const addToRecent = (location: string) => {
    const updated = [
      location,
      ...recentSearches.filter((item) => item !== location),
    ].slice(0, 3)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setQuery(value)
    if (value) {
      const filteredSuggestions = data.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filteredSuggestions.sort())
    } else {
      setSuggestions(data.sort())
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    inputRef.current?.focus()
    setIsFocused(false)
  }

  const handleAction = (location: string, action: 'highlight' | 'jump') => {
    addToRecent(location)
    if (action === 'highlight') {
      highlightCallback(location)
    } else {
      jumpToCallback(location)
    }
    setQuery(location)
    setIsFocused(false)
  }

  const clearSearch = () => {
    setQuery('')
    setSuggestions(data.sort())
  }

  return (
    <div className="search-container">
      <div className="flex flex-col w-full">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search a location..."
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            onFocus={() => {
              setIsFocused(true)
              if (!query) setSuggestions(data.sort())
            }}
            aria-label="Search for a location"
          />
          {query && (
            <button
              className="clear-button"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex w-full gap-2 mt-2">
          <button
            onClick={() => handleAction(query, 'highlight')}
            disabled={!IncludesValue(data, query)}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            aria-label="Highlight location"
          >
            <Eye size={14} aria-hidden="true" /> Guide
          </button>
          <button
            onClick={() => handleAction(query, 'jump')}
            disabled={!IncludesValue(data, query)}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-500 rounded-md disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            aria-label="Go to location"
          >
            <ArrowUpRight size={14} aria-hidden="true" /> Go To
          </button>
        </div>
      </div>

      {isFocused && (
        <div className="dropdown-container" ref={dropdownRef}>
          {!query && recentSearches.length > 0 && (
            <div className="recent-searches">
              <h3 className="px-4 py-2 m-0 text-sm font-semibold text-gray-600 uppercase bg-gray-50">
                Recent Searches
              </h3>
              {recentSearches.map((recent, index) => (
                <div key={`recent-${index}`} className="suggestion-item cursor-pointer hover:text-blue-500" onClick={() => handleSuggestionClick(recent)}>
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
      )}
    </div>
  )
}

export default SearchBar
