import React, {
  useState,
  ChangeEvent,
  MouseEvent,
  useRef,
  useEffect,
} from "react";
import "../../css/SearchBar.css";
import { X } from "react-feather";
import DropDownContainer from "./DropDownContainer";
import SearchBarButtons from "./SearchBarButtons";
import { toast } from "react-toastify";
import { getLabelLongName, getLabelDisplayName } from "../../utils/labelUtils";
import { Label } from "../../types";

// Define the type for the props
interface SearchBarProps {
  currentPoint: { location: string };
  searchableLabels: Label[];
  jumpToCallback: (selected: string) => void;
  highlightCallback: (selected: string) => void;
  isPathfindingMode?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  currentPoint,
  searchableLabels,
  jumpToCallback,
  highlightCallback,
  isPathfindingMode,
}) => {
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Label[]>([]);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<Label[]>(() => {
    const saved = localStorage.getItem("recentSearches");
    return saved ? JSON.parse(saved) : [];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside as any);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside as any);
    };
  }, []);

  const addToRecent = (location: Label) => {
    const updated = [
      location,
      ...recentSearches.filter((item) => item !== location),
    ].slice(0, 3);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toLowerCase();
    setQuery(value);
    if (value) {
      const filteredSuggestions = searchableLabels.filter((item) => {
        const formattedLabel = getLabelLongName(item);
        const displayName = getLabelDisplayName(item);
        return (
          formattedLabel.toLowerCase().includes(value) ||
          displayName.toLowerCase().includes(value) ||
          item.parents.some(parent => parent.toLowerCase().includes(value))
        );
      });
      setSuggestions(
        filteredSuggestions.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
      );
    } else {
      setSuggestions(
        searchableLabels.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
      );
    }
  };

  const handleSuggestionClick = (suggestion: Label, hide = true) => {
    setQuery(getLabelLongName(suggestion));
    if (hide) {
      inputRef.current?.focus();
      setIsFocused(false);
    }
  };

  const handleAction = (label: string, action: "highlight" | "jump") => {
    if (isPathfindingMode && label === "" && action === "highlight") {
      // Clear path edge case
      highlightCallback("");
      return;
    }

    // Find the label object based on formatted name or short name
    let labelObj = searchableLabels.find((v: Label) =>
      getLabelLongName(v).toLowerCase().includes(label.toLowerCase())
    );
    if (!labelObj) {
      labelObj = searchableLabels.find(
        (v: Label) => v.label.toLowerCase() === label.toLowerCase()
      );
    }

    // Validate Label
    if (!labelObj || !labelObj.query || !labelObj.label) {
      toast.error("Label is invalid: " + label);
      console.error(
        "Label is invalid: " +
          label +
          " Could not find labelObj:" +
          JSON.stringify(labelObj)
      );
      return;
    }

    // Apply action to found label
    addToRecent(labelObj);
    if (action === "highlight") {
      highlightCallback(labelObj.query);
    } else {
      jumpToCallback(labelObj.query);
    }
    setQuery(getLabelLongName(labelObj));
    setIsFocused(false);
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions(
      searchableLabels.sort((a, b) => getLabelLongName(a).localeCompare(getLabelLongName(b)))
    );
  };

  return (
    <div className="search-container">
      <div className="flex flex-col w-full">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                handleAction(query, "jump");
              }
            }}
            placeholder="Search a location..."
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg shadow-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
            onFocus={() => {
              setIsFocused(true);
              if (!query)
                setSuggestions(
                  searchableLabels.sort((a, b) =>
                    getLabelLongName(a).localeCompare(getLabelLongName(b))
                  )
                );
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
          isPathfindingMode={isPathfindingMode}
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
  );
};

export default SearchBar;
