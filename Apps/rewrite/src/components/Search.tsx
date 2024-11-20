import { useState, useEffect } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Combobox } from '@headlessui/react';
import { useTourStore } from '../store';

export const Search = () => {
  const [query, setQuery] = useState('');
  const { locations, nodes, findPathToLocation, currentNode } = useTourStore();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const filteredLocations = query === ''
    ? locations
    : locations.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (locationId: number) => {
    setSelectedLocation(locationId);
    findPathToLocation(locationId);
  };

  return (
    <div className="fixed top-4 left-4 w-64">
      <Combobox value={selectedLocation} onChange={handleSelect}>
        <div className="relative">
          <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md focus:outline-none sm:text-sm">
            <Combobox.Input
              className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
              onChange={(event) => setQuery(event.target.value)}
              displayValue={(locationId: number) => 
                locations.find(l => l.id === locationId)?.name ?? ''
              }
              placeholder="Search locations..."
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </Combobox.Button>
          </div>
          <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredLocations.map((location) => (
              <Combobox.Option
                key={location.id}
                value={location.id}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-blue-600 text-white' : 'text-gray-900'
                  }`
                }
              >
                {location.name}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </div>
      </Combobox>
    </div>
  );
};