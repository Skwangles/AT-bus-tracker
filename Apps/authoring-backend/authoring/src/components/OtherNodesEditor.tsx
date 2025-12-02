import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'
import OtherNodeEditor from './OtherNodeEditor'

interface OtherNodeWithLocation {
  id: number
  ref_id: number
  label: string
  description: string
  info: string
  image: string
  type: number
  x_trans: number
  y_trans: number
  z_trans: number
  location: string | null
}

interface LocationGroup {
  id: number
  name: string
  description?: string
}

const OtherNodesEditor: React.FC = () => {
  const [otherNodes, setOtherNodes] = useState<OtherNodeWithLocation[]>([])
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([])
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('')
  const [selectedNode, setSelectedNode] = useState<OtherNodeWithLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const nodeTypes = {
    0: { name: 'Normal', color: '#007bff', icon: '📍' },
    1: { name: 'Elevator', color: '#28a745', icon: '🛗' },
    2: { name: 'Toilet', color: '#ffc107', icon: '🚻' },
    3: { name: 'Info', color: '#17a2b8', icon: 'ℹ️' },
    4: { name: 'Stair', color: '#6f42c1', icon: '🪜' },
    5: { name: 'Exit', color: '#dc3545', icon: '🚪' },
    50: { name: 'Border', color: '#ff6b35', icon: '🔗' },
  }

  const fetchLocationGroups = async () => {
    try {
      const response = await axios.get<LocationGroup[]>(`${API_PREFIX}/api/v1/location-groups`)
      setLocationGroups(response.data)
    } catch (err) {
      console.error('Error fetching location groups:', err)
    }
  }

  const fetchOtherNodes = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = selectedLocationFilter ? { location: selectedLocationFilter } : {}
      const response = await axios.get<{ otherNodes: OtherNodeWithLocation[] }>(
        `${API_PREFIX}/api/v1/labels/other-nodes`,
        { params }
      )
      setOtherNodes(response.data.otherNodes || [])
    } catch (err) {
      console.error('Error fetching other nodes:', err)
      setError('Failed to load other nodes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocationGroups()
  }, [])

  useEffect(() => {
    fetchOtherNodes()
  }, [selectedLocationFilter])

  const handleNodeSelect = (node: OtherNodeWithLocation) => {
    setSelectedNode(node)
  }

  const handleNodeUpdate = () => {
    fetchOtherNodes()
    // Keep the same node selected if it still exists
  }

  const filteredNodes = otherNodes.filter(node => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      node.label.toLowerCase().includes(searchLower) ||
      node.description?.toLowerCase().includes(searchLower) ||
      String(node.id).includes(searchLower) ||
      String(node.ref_id).includes(searchLower) ||
      (node.location && node.location.toLowerCase().includes(searchLower))
    )
  })

  return (
    <div className="other-nodes-editor">
      <div className="editor-header">
        <h2>Other Nodes Editor</h2>
        <div className="header-controls">
          <div className="filter-group">
            <label htmlFor="location-filter">Location Group:</label>
            <select
              id="location-filter"
              value={selectedLocationFilter}
              onChange={(e) => setSelectedLocationFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              {locationGroups.map((group) => (
                <option key={group.name} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="search-group">
            <label htmlFor="search">Search:</label>
            <input
              id="search"
              type="text"
              placeholder="Search by label, description, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchOtherNodes} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="nodes-list-panel">
          {loading ? (
            <div className="loading">Loading other nodes...</div>
          ) : error ? (
            <div className="error">
              {error}
              <button onClick={fetchOtherNodes} className="retry-btn">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="nodes-count">
                Showing {filteredNodes.length} of {otherNodes.length} other nodes
              </div>
              <div className="nodes-list">
                {filteredNodes.length === 0 ? (
                  <div className="no-nodes">
                    {otherNodes.length === 0
                      ? 'No other nodes found'
                      : 'No nodes match your search'}
                  </div>
                ) : (
                  filteredNodes.map((node) => (
                    <div
                      key={node.id}
                      className={`node-item ${selectedNode?.id === node.id ? 'selected' : ''}`}
                      onClick={() => handleNodeSelect(node)}
                    >
                      <div className="node-header">
                        <span
                          className="node-type"
                          style={{
                            color:
                              nodeTypes[node.type as keyof typeof nodeTypes]?.color || '#666',
                          }}
                        >
                          {nodeTypes[node.type as keyof typeof nodeTypes]?.icon || '📍'}
                        </span>
                        <span className="node-label">{node.label || `Node ${node.id}`}</span>
                        <span className="node-id">#{node.id}</span>
                      </div>
                      <div className="node-details">
                        <div className="detail-row">
                          <span className="detail-label">Ref Node:</span>
                          <span className="detail-value">#{node.ref_id}</span>
                        </div>
                        {node.location && (
                          <div className="detail-row">
                            <span className="detail-label">Location:</span>
                            <span className="detail-value">{node.location}</span>
                          </div>
                        )}
                        {node.description && (
                          <div className="detail-row">
                            <span className="detail-label">Description:</span>
                            <span className="detail-value">{node.description}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="detail-label">Position:</span>
                          <span className="detail-value">
                            ({node.x_trans.toFixed(3)}, {node.y_trans.toFixed(3)},{' '}
                            {node.z_trans.toFixed(3)})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {selectedNode && (
          <div className="node-editor-panel">
            <OtherNodeEditor
              otherNode={selectedNode}
              onUpdate={handleNodeUpdate}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>

      <style>{`
        .other-nodes-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        .editor-header {
          background: white;
          border-bottom: 1px solid #ddd;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .editor-header h2 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 24px;
        }

        .header-controls {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-group,
        .search-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label,
        .search-group label {
          font-weight: 500;
          color: #666;
          font-size: 14px;
        }

        .filter-group select,
        .search-group input {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .search-group input {
          min-width: 200px;
        }

        .refresh-btn {
          padding: 6px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-btn:hover {
          background: #0056b3;
        }

        .editor-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }

        .nodes-list-panel {
          flex: 1;
          background: white;
          margin: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .nodes-count {
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          color: #666;
          font-size: 14px;
        }

        .nodes-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .node-item {
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: #f8f9fa;
        }

        .node-item:hover {
          background: #e9ecef;
          border-color: #007bff;
        }

        .node-item.selected {
          background: #e7f3ff;
          border-color: #007bff;
          border-width: 2px;
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .node-type {
          font-size: 18px;
        }

        .node-label {
          flex: 1;
          font-weight: 500;
          color: #333;
        }

        .node-id {
          font-size: 12px;
          color: #666;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .node-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
        }

        .detail-row {
          display: flex;
          gap: 8px;
        }

        .detail-label {
          color: #666;
          font-weight: 500;
          min-width: 80px;
        }

        .detail-value {
          color: #333;
        }

        .node-editor-panel {
          width: 500px;
          min-width: 500px;
          background: white;
          margin: 16px;
          margin-left: 0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow-y: auto;
        }

        .loading,
        .error,
        .no-nodes {
          padding: 32px;
          text-align: center;
          color: #666;
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

        @media (max-width: 1200px) {
          .editor-content {
            flex-direction: column;
          }

          .node-editor-panel {
            width: auto;
            min-width: auto;
            margin: 16px;
          }
        }
      `}</style>
    </div>
  )
}

export default OtherNodesEditor
