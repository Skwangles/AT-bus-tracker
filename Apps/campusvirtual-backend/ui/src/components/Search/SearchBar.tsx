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
import { Label } from '../../consts'
import { toast } from 'react-toastify'
// Define the type for the props
interface SearchBarProps {
  currentPoint: { location: string }
  searchableLabels: Label[]
  jumpToCallback: (selected: string) => void
  highlightCallback: (selected: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({
  currentPoint,
  searchableLabels,
  jumpToCallback,
  highlightCallback,
}) => {
  const [query, setQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<Label[]>([])
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const [recentSearches, setRecentSearches] = useState<Label[]>(() => {
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

  const addToRecent = (location: Label) => {
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
      const filteredSuggestions = searchableLabels.filter((item) => {
        const largeName =
          (item.group ? item.group.toLowerCase() + ' - ' : '') +
          item.label.toLowerCase()
        const result =
          largeName.includes(value.toLowerCase()) &&
          value.length <= largeName.length
        return result
      })
      setSuggestions(
        filteredSuggestions.sort((a, b) => a.label.localeCompare(b.label))
      )
    } else {
      setSuggestions(
        searchableLabels.sort((a, b) => a.label.localeCompare(b.label))
      )
    }
  }

  const handleSuggestionClick = (suggestion: Label, hide = true) => {
    setQuery(
      (suggestion.group ? suggestion.group.trim() + ' - ' : '') +
        suggestion.label.trim()
    )
    if (hide) {
      inputRef.current?.focus()
      setIsFocused(false)
    }
  }

  const handleAction = (label: string, action: 'highlight' | 'jump') => {
    let labelObj = searchableLabels.find(
      (v: Label) =>
        ((v.group ? v.group + ' - ' : '') + v.label).toLowerCase() ===
        label.toLowerCase()
    )
    if (!labelObj) {
      labelObj = searchableLabels.find(
        (v: Label) => v.label.toLowerCase() === label.toLowerCase()
      )
    }

    if (!labelObj || !labelObj.query || !labelObj.label) {
      toast.error('Label is invalid: ' + label)
      console.error(
        'Label is invalid: ' +
          label +
          ' Could not find labelObj:' +
          JSON.stringify(labelObj)
      )
      return
    }

    addToRecent(labelObj)
    if (action === 'highlight') {
      highlightCallback(labelObj.query)
    } else {
      jumpToCallback(labelObj.query)
    }
    setQuery(labelObj.label)
    setIsFocused(false)
  }

  const clearSearch = () => {
    setQuery('')
    setSuggestions(
      searchableLabels.sort((a, b) => a.label.localeCompare(b.label))
    )
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
              if (!query)
                setSuggestions(
                  searchableLabels.sort((a, b) =>
                    a.label.localeCompare(b.label)
                  )
                )
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
          currentPoint={currentPoint}
          query={query}
          handleAction={handleAction}
          labels={searchableLabels}
        />
      </div>

      {isFocused && (
        <DropDownContainer
          setIsFocused={setIsFocused}
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
