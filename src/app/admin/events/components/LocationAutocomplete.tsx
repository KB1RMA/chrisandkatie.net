'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type LocationAutocompleteProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;
const MAX_RESULTS = 6;

/**
 * Fetches address suggestions from the Nominatim OpenStreetMap geocoding API.
 *
 * @param query - The search string to geocode.
 * @returns An array of matching place results.
 */
async function fetchSuggestions(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: String(MAX_RESULTS),
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        // Nominatim requires a descriptive User-Agent to prevent blocks
        'Accept-Language': 'en-US,en',
      },
    },
  );

  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<NominatimResult[]>;
}

/**
 * Address autocomplete input backed by the Nominatim OpenStreetMap geocoding API.
 *
 * Debounces keystrokes and shows a dropdown of address suggestions. Selecting a
 * suggestion writes the full formatted address into the field and notifies the
 * parent via `onChange`.
 *
 * @param props.id - HTML id for the input element.
 * @param props.value - Controlled value of the input.
 * @param props.onChange - Called with the new string value whenever it changes.
 * @param props.className - Additional CSS classes for the input element.
 * @param props.placeholder - Placeholder text shown in the empty input.
 * @returns A positioned wrapper containing the input and suggestion dropdown.
 */
export default function LocationAutocomplete({
  id,
  value,
  onChange,
  className = '',
  placeholder = 'Start typing an address…',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handle input change: update the controlled value and trigger debounced geocoding.
   *
   * @param event - The native input change event.
   */
  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    onChange(query);
    setActiveIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);

      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);

      try {
        const results = await fetchSuggestions(query);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  /**
   * Commit a selected suggestion to the input field and close the dropdown.
   *
   * @param suggestion - The Nominatim result selected by the user.
   */
  const handleSelect = useCallback(
    (suggestion: NominatimResult) => {
      onChange(suggestion.display_name);
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [onChange],
  );

  /**
   * Handle keyboard navigation within the autocomplete dropdown.
   *
   * @param event - The keyboard event from the input element.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        aria-autocomplete="list"
        aria-controls={isOpen ? 'location-suggestions' : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `location-suggestion-${activeIndex}` : undefined
        }
      />

      {isLoading && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#9e3f3f] border-t-transparent" />
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          id="location-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.place_id}
              id={`location-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                // Prevent the input from losing focus before the click registers
                e.preventDefault();
                handleSelect(suggestion);
              }}
              className={[
                'cursor-pointer px-3 py-2 text-sm',
                index === activeIndex
                  ? 'bg-[#9e3f3f] text-white'
                  : 'text-gray-800 hover:bg-gray-100',
              ].join(' ')}
            >
              {suggestion.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
