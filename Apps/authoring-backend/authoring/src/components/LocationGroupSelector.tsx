import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'

interface LocationGroup {
  name: string
  pointCount: number
  hasImage: boolean
  imagePath?: string
  lastModified?: string
  description?: string
}

interface LocationGroupSelectorProps {
  selectedLocation: string | null
  onLocationSelect: (location: string) => void
  onLocationCreate?: (name: string) => void
}

const LocationGroupSelector: React.FC<LocationGroupSelectorProps> = ({
  selectedLocation,
  onLocationSelect,
  onLocationCreate
}) => {
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'points' | 'modified'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const fetchLocationGroups = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get<LocationGroup[]>(`${API_PREFIX}/api/v1/location-groups`)
      setLocationGroups(response.data)
    } catch (err) {
      console.error('Error fetching location groups:', err)
      setError('Failed to load location groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocationGroups()
  }, [])

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) return

    try {
      await axios.post(`${API_PREFIX}/api/v1/location-groups`, {
        name: newLocationName.trim(),
        description: `Location group: ${newLocationName.trim()}`
      })
      
      setNewLocationName('')
      setShowCreateForm(false)
      fetchLocationGroups() // Refresh the list
      
      if (onLocationCreate) {
        onLocationCreate(newLocationName.trim())
      }
    } catch (err) {
      console.error('Error creating location group:', err)
      setError('Failed to create location group')
    }
  }

  const handleSort = (field: 'name' | 'points' | 'modified') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedGroups = locationGroups
    .filter(group => 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'points':
          aValue = a.pointCount
          bValue = b.pointCount
          break
        case 'modified':
          aValue = a.lastModified || ''
          bValue = b.lastModified || ''
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const getSortIcon = (field: 'name' | 'points' | 'modified') => {
    if (sortBy !== field) return '↕️'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  if (loading) {
    return (
      <div className="location-group-selector">
        <div className="loading">Loading location groups...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="location-group-selector">
        <div className="error">
          {error}
          <button onClick={fetchLocationGroups} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="location-group-selector">
      <div className="selector-header">
        <h3>Location Groups</h3>
        <div className="controls">
          <input
            type="text"
            placeholder="Search location groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="create-btn"
          >
            {showCreateForm ? 'Cancel' : 'Create New'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="create-form">
          <input
            type="text"
            placeholder="Enter location group name..."
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            className="create-input"
            onKeyPress={(e) => e.key === 'Enter' && handleCreateLocation()}
          />
          <button
            onClick={handleCreateLocation}
            disabled={!newLocationName.trim()}
            className="create-submit-btn"
          >
            Create
          </button>
        </div>
      )}

      <div className="location-list">
        <div className="list-header">
          <button
            className={`sort-btn ${sortBy === 'name' ? 'active' : ''}`}
            onClick={() => handleSort('name')}
          >
            Name {getSortIcon('name')}
          </button>
          <button
            className={`sort-btn ${sortBy === 'points' ? 'active' : ''}`}
            onClick={() => handleSort('points')}
          >
            Points {getSortIcon('points')}
          </button>
          <button
            className={`sort-btn ${sortBy === 'modified' ? 'active' : ''}`}
            onClick={() => handleSort('modified')}
          >
            Modified {getSortIcon('modified')}
          </button>
          <span className="header-status">Status</span>
        </div>

        <div className="location-items">
          {filteredAndSortedGroups.length === 0 ? (
            <div className="no-results">
              {searchTerm ? 'No location groups match your search' : 'No location groups found'}
            </div>
          ) : (
            filteredAndSortedGroups.map((group) => (
              <div
                key={group.name}
                className={`location-item ${selectedLocation === group.name ? 'selected' : ''}`}
                onClick={() => onLocationSelect(group.name)}
              >
                <div className="item-name">{group.name}</div>
                <div className="item-points">{group.pointCount} points</div>
                <div className="item-modified">
                  {group.lastModified 
                    ? new Date(group.lastModified).toLocaleDateString()
                    : 'Unknown'
                  }
                </div>
                <div className="item-status">
                  <span className={`status-indicator ${group.hasImage ? 'has-image' : 'no-image'}`}>
                    {group.hasImage ? '📷' : '❌'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .location-group-selector {
          width: 100%;
          max-width: 400px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .selector-header {
          padding: 16px;
          border-bottom: 1px solid #eee;
        }

        .selector-header h3 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 18px;
        }

        .controls {
          display: flex;
          gap: 8px;
        }

        .search-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .create-btn {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .create-btn:hover {
          background: #0056b3;
        }

        .create-form {
          padding: 16px;
          border-bottom: 1px solid #eee;
          display: flex;
          gap: 8px;
        }

        .create-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .create-submit-btn {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .create-submit-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .location-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .list-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 80px;
          gap: 8px;
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #eee;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          color: #666;
        }

        .sort-btn {
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          color: #666;
          padding: 0;
        }

        .sort-btn:hover {
          color: #333;
        }

        .sort-btn.active {
          color: #007bff;
        }

        .location-items {
          max-height: 300px;
          overflow-y: auto;
        }

        .location-item {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 80px;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .location-item:hover {
          background: #f8f9fa;
        }

        .location-item.selected {
          background: #e3f2fd;
          border-left: 4px solid #007bff;
        }

        .item-name {
          font-weight: 500;
          color: #333;
        }

        .item-points {
          color: #666;
          font-size: 14px;
        }

        .item-modified {
          color: #666;
          font-size: 12px;
        }

        .item-status {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-indicator {
          font-size: 16px;
        }

        .status-indicator.has-image {
          color: #28a745;
        }

        .status-indicator.no-image {
          color: #dc3545;
        }

        .no-results {
          padding: 32px 16px;
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .loading, .error {
          padding: 32px 16px;
          text-align: center;
        }

        .error {
          color: #dc3545;
        }

        .retry-btn {
          margin-left: 8px;
          padding: 4px 8px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .retry-btn:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  )
}

export default LocationGroupSelector 