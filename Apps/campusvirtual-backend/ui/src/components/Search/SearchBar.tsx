// src/SearchBar.tsx
import React, {
  useState,
  ChangeEvent,
  MouseEvent,
  useRef,
  useEffect,
} from 'react'
import '../../css/SearchBar.css'
import { X } from 'react-feather'
import DropDownContainer from './DropDownContainer'
import SearchBarButtons from './SearchBarButtons'
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

        <SearchBarButtons
          query={query}
          handleAction={handleAction}
          data={data}
          IncludesValue={IncludesValue}
        />
      </div>

      {isFocused && (
        <DropDownContainer
          dropdownRef={dropdownRef}
          recentSearches={recentSearches}
          query={query}
          suggestions={suggestions}
          handleSuggestionClick={handleSuggestionClick}
        />
      )}
    </div>
  )
}

export default SearchBar
