import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'

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

interface RefNodeInfo {
  keyframe_id: number
  x_trans: number
  y_trans: number
  z_trans: number
  location?: string
}

interface NeighbourInfo {
  keyframe_id: number
  x_trans: number
  y_trans: number
  z_trans: number
}

interface OtherNodeEditorProps {
  otherNode: OtherNodeWithLocation
  onUpdate: () => void
  onClose: () => void
}

const OtherNodeEditor: React.FC<OtherNodeEditorProps> = ({
  otherNode,
  onUpdate,
  onClose,
}) => {
  const [refNodeInfo, setRefNodeInfo] = useState<RefNodeInfo | null>(null)
  const [neighbours, setNeighbours] = useState<NeighbourInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Position state - absolute
  const [absX, setAbsX] = useState(otherNode.x_trans)
  const [absY, setAbsY] = useState(otherNode.y_trans)
  const [absZ, setAbsZ] = useState(otherNode.z_trans)

  // Position state - relative (calculated from absolute and ref_node)
  const [relX, setRelX] = useState(0)
  const [relY, setRelY] = useState(0)
  const [relZ, setRelZ] = useState(0)

  // Visualization scale state
  const [vizScale, setVizScale] = useState(100)

  // Drag state for 2D visualization
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  const nodeTypes = {
    0: { name: 'Normal', color: '#007bff', icon: '📍' },
    1: { name: 'Elevator', color: '#28a745', icon: '🛗' },
    2: { name: 'Toilet', color: '#ffc107', icon: '🚻' },
    3: { name: 'Info', color: '#17a2b8', icon: 'ℹ️' },
    4: { name: 'Stair', color: '#6f42c1', icon: '🪜' },
    5: { name: 'Exit', color: '#dc3545', icon: '🚪' },
    50: { name: 'Border', color: '#ff6b35', icon: '🔗' },
  }

  const fetchRefNodeInfo = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get<RefNodeInfo>(`${API_PREFIX}/api/v1/point/${otherNode.ref_id}`)
      setRefNodeInfo(response.data)

      // Fetch neighbours
      try {
        const neighboursResponse = await axios.get<NeighbourInfo[]>(
          `${API_PREFIX}/api/v1/point/${otherNode.ref_id}/neighbours`
        )
        setNeighbours(neighboursResponse.data || [])
      } catch (neighbourErr) {
        console.warn('Error fetching neighbours:', neighbourErr)
        setNeighbours([])
      }
    } catch (err) {
      console.error('Error fetching ref node info:', err)
      setError('Failed to load reference node information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRefNodeInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherNode.ref_id])

  useEffect(() => {
    // Update absolute values when otherNode changes
    setAbsX(otherNode.x_trans)
    setAbsY(otherNode.y_trans)
    setAbsZ(otherNode.z_trans)
  }, [otherNode])

  useEffect(() => {
    // Calculate relative position when ref node info is available
    if (refNodeInfo) {
      setRelX(absX - refNodeInfo.x_trans)
      setRelY(absY - refNodeInfo.y_trans)
      setRelZ(absZ - refNodeInfo.z_trans)
    }
  }, [refNodeInfo, absX, absY, absZ])

  const handleAbsoluteChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (isNaN(value)) return

    if (axis === 'x') setAbsX(value)
    if (axis === 'y') setAbsY(value)
    if (axis === 'z') setAbsZ(value)
  }

  const handleRelativeChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (isNaN(value) || !refNodeInfo) return

    if (axis === 'x') {
      setRelX(value)
      setAbsX(refNodeInfo.x_trans + value)
    }
    if (axis === 'y') {
      setRelY(value)
      setAbsY(refNodeInfo.y_trans + value)
    }
    if (axis === 'z') {
      setRelZ(value)
      setAbsZ(refNodeInfo.z_trans + value)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await axios.patch(`${API_PREFIX}/api/v1/labels/other-node/${otherNode.id}/position`, {
        x_trans: absX,
        y_trans: absY,
        z_trans: absZ,
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onUpdate()
      }, 1500)
    } catch (err) {
      console.error('Error updating position:', err)
      setError('Failed to update position')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setAbsX(otherNode.x_trans)
    setAbsY(otherNode.y_trans)
    setAbsZ(otherNode.z_trans)
  }

  // Calculate visualization scale and offset for 2D view (X-Z plane)
  const getVisualizationData = () => {
    if (!refNodeInfo) return null

    const centerX = 200
    const centerZ = 200

    const refX = centerX
    const refZ = centerZ
    const otherX = centerX + relX * vizScale
    const otherZ = centerZ - relZ * vizScale // Invert Z for screen coordinates

    const distance = Math.sqrt(relX * relX + relZ * relZ)

    // Calculate neighbour positions relative to ref node (X-Z plane)
    const neighbourPositions = neighbours.map((neighbour) => {
      const neighbourRelX = neighbour.x_trans - refNodeInfo.x_trans
      const neighbourRelZ = neighbour.z_trans - refNodeInfo.z_trans
      const neighbourX = centerX + neighbourRelX * vizScale
      const neighbourZ = centerZ - neighbourRelZ * vizScale // Invert Z for screen coordinates
      return {
        keyframe_id: neighbour.keyframe_id,
        x: neighbourX,
        z: neighbourZ,
        relX: neighbourRelX,
        relZ: neighbourRelZ,
      }
    })

    return {
      refX,
      refZ,
      otherX,
      otherZ,
      distance,
      scale: vizScale,
      neighbours: neighbourPositions,
    }
  }

  const handleScaleChange = (newScale: number) => {
    if (isNaN(newScale) || newScale < 1 || newScale > 1000) return
    setVizScale(newScale)
  }

  const handleZoomIn = () => {
    setVizScale((prev) => Math.min(prev * 1.5, 1000))
  }

  const handleZoomOut = () => {
    setVizScale((prev) => Math.max(prev / 1.5, 1))
  }

  const handleResetScale = () => {
    setVizScale(100)
  }

  // Handle dragging in the 2D visualization
  const handleNodeMouseDown = (e: React.MouseEvent<SVGCircleElement>) => {
    if (!refNodeInfo || !vizData) return

    const svg = e.currentTarget.closest('svg')
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDragging(true)
    setDragStart({ x, y })
    e.preventDefault()
    e.stopPropagation()
  }

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !dragStart || !refNodeInfo || !vizData) return

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left
    const z = e.clientY - rect.top

    // Calculate the offset from the reference node
    const centerX = 200
    const centerZ = 200

    // Convert SVG coordinates to world coordinates (X-Z plane)
    const newRelX = (x - centerX) / vizScale
    const newRelZ = -(z - centerZ) / vizScale // Invert Z axis for screen coordinates

    // Update positions
    setRelX(newRelX)
    setRelZ(newRelZ)
    setAbsX(refNodeInfo.x_trans + newRelX)
    setAbsZ(refNodeInfo.z_trans + newRelZ)
  }

  const handleSvgMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  // Handle mouse leave to stop dragging if cursor leaves SVG
  const handleSvgMouseLeave = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  const vizData = getVisualizationData()

  return (
    <div className="other-node-editor">
      <div className="editor-header">
        <div className="header-left">
          <h3>
            {nodeTypes[otherNode.type as keyof typeof nodeTypes]?.icon || '📍'}{' '}
            {otherNode.label || `Node ${otherNode.id}`}
          </h3>
          <span className="node-id">ID: #{otherNode.id}</span>
        </div>
        <button onClick={onClose} className="close-btn">
          ×
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading reference node information...</div>
      ) : error && !refNodeInfo ? (
        <div className="error">
          {error}
          <button onClick={fetchRefNodeInfo} className="retry-btn">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Basic Information */}
          <div className="info-section">
            <h4>Basic Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <label>Ref Node ID:</label>
                <span>#{otherNode.ref_id}</span>
              </div>
              {otherNode.location && (
                <div className="info-item">
                  <label>Location:</label>
                  <span>{otherNode.location}</span>
                </div>
              )}
              {otherNode.description && (
                <div className="info-item">
                  <label>Description:</label>
                  <span>{otherNode.description}</span>
                </div>
              )}
              <div className="info-item">
                <label>Type:</label>
                <span>
                  {nodeTypes[otherNode.type as keyof typeof nodeTypes]?.name || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Reference Node Position */}
          {refNodeInfo && (
            <div className="info-section">
              <h4>Reference Node Position</h4>
              <div className="position-display">
                <div className="position-item">
                  <span className="position-label">X:</span>
                  <span className="position-value">{refNodeInfo.x_trans.toFixed(3)}</span>
                </div>
                <div className="position-item">
                  <span className="position-label">Y:</span>
                  <span className="position-value">{refNodeInfo.y_trans.toFixed(3)}</span>
                </div>
                <div className="position-item">
                  <span className="position-label">Z:</span>
                  <span className="position-value">{refNodeInfo.z_trans.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Position Editing */}
          <div className="info-section">
            <h4>Position Editing</h4>

            <div className="position-editor">
              <div className="position-group">
                <h5>Absolute Position</h5>
                <div className="input-group">
                  <label>X:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={absX}
                    onChange={(e) => handleAbsoluteChange('x', parseFloat(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label>Y:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={absY}
                    onChange={(e) => handleAbsoluteChange('y', parseFloat(e.target.value))}
                  />
                </div>
                <div className="input-group">
                  <label>Z:</label>
                  <input
                    type="number"
                    step="0.001"
                    value={absZ}
                    onChange={(e) => handleAbsoluteChange('z', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {refNodeInfo && (
                <div className="position-group">
                  <h5>Relative to Ref Node</h5>
                  <div className="input-group">
                    <label>X Offset:</label>
                    <input
                      type="number"
                      step="0.001"
                      value={relX.toFixed(3)}
                      onChange={(e) => handleRelativeChange('x', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Y Offset:</label>
                    <input
                      type="number"
                      step="0.001"
                      value={relY.toFixed(3)}
                      onChange={(e) => handleRelativeChange('y', parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Z Offset:</label>
                    <input
                      type="number"
                      step="0.001"
                      value={relZ.toFixed(3)}
                      onChange={(e) => handleRelativeChange('z', parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2D Visualization */}
          {vizData && (
            <div className="info-section">
              <div className="visualization-header">
                <h4>2D Visualization (X/Z Plane)</h4>
                <div className="scale-controls">
                  <label htmlFor="scale-slider">Scale:</label>
                  <div className="scale-input-group">
                    <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">
                      −
                    </button>
                    <input
                      id="scale-slider"
                      type="range"
                      min="1"
                      max="1000"
                      value={vizScale}
                      onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                      className="scale-slider"
                    />
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      value={Math.round(vizScale)}
                      onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                      className="scale-input"
                    />
                    <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">
                      +
                    </button>
                    <button onClick={handleResetScale} className="reset-scale-btn" title="Reset Scale">
                      Reset
                    </button>
                  </div>
                  <span className="scale-unit">px/unit</span>
                </div>
              </div>
              <div className="visualization-container">
                <svg
                  width="400"
                  height="400"
                  className="visualization-svg"
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={handleSvgMouseUp}
                  onMouseLeave={handleSvgMouseLeave}
                  style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                >
                  {/* Grid lines */}
                  <defs>
                    <pattern
                      id="grid"
                      width="20"
                      height="20"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 20 0 L 0 0 0 20"
                        fill="none"
                        stroke="#e0e0e0"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="400" height="400" fill="url(#grid)" />

                  {/* Axes */}
                  <line
                    x1={vizData.refX}
                    y1={0}
                    x2={vizData.refX}
                    y2={400}
                    stroke="#999"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <line
                    x1={0}
                    y1={vizData.refZ}
                    x2={400}
                    y2={vizData.refZ}
                    stroke="#999"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />

                  {/* Neighbour connection lines */}
                  {vizData.neighbours.map((neighbour) => (
                    <line
                      key={`neighbour-line-${neighbour.keyframe_id}`}
                      x1={vizData.refX}
                      y1={vizData.refZ}
                      x2={neighbour.x}
                      y2={neighbour.z}
                      stroke="#ccc"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                      opacity="0.6"
                    />
                  ))}

                  {/* Neighbour nodes */}
                  {vizData.neighbours.map((neighbour) => (
                    <g key={`neighbour-${neighbour.keyframe_id}`}>
                      <circle
                        cx={neighbour.x}
                        cy={neighbour.z}
                        r="6"
                        fill="#6c757d"
                        stroke="#fff"
                        strokeWidth="1.5"
                        opacity="0.8"
                      />
                      <text
                        x={neighbour.x}
                        y={neighbour.z - 12}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6c757d"
                        fontWeight="500"
                      >
                        #{neighbour.keyframe_id}
                      </text>
                    </g>
                  ))}

                  {/* Connection line to other node */}
                  <line
                    x1={vizData.refX}
                    y1={vizData.refZ}
                    x2={vizData.otherX}
                    y2={vizData.otherZ}
                    stroke="#007bff"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                  />

                  {/* Ref node */}
                  <circle
                    cx={vizData.refX}
                    cy={vizData.refZ}
                    r="8"
                    fill="#28a745"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  <text
                    x={vizData.refX}
                    y={vizData.refZ - 15}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#28a745"
                    fontWeight="bold"
                  >
                    Ref Node
                  </text>

                  {/* Other node - draggable */}
                  {/* Invisible larger hit area for easier dragging */}
                  <circle
                    cx={vizData.otherX}
                    cy={vizData.otherZ}
                    r="20"
                    fill="transparent"
                    stroke="transparent"
                    onMouseDown={handleNodeMouseDown}
                    style={{ cursor: 'grab', pointerEvents: 'all' }}
                  />
                  <circle
                    cx={vizData.otherX}
                    cy={vizData.otherZ}
                    r="8"
                    fill="#007bff"
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: 'grab', pointerEvents: 'none' }}
                    className="draggable-node"
                  />
                  <text
                    x={vizData.otherX}
                    y={vizData.otherZ - 15}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#007bff"
                    fontWeight="bold"
                  >
                    Other Node
                  </text>

                  {/* Distance label */}
                  {vizData.distance > 0.1 && (
                    <text
                      x={(vizData.refX + vizData.otherX) / 2}
                      y={(vizData.refZ + vizData.otherZ) / 2 - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#666"
                    >
                      {vizData.distance.toFixed(2)} units
                    </text>
                  )}
                </svg>
                <div className="visualization-info">
                  <p className="info-hint">
                    💡 <strong>Tip:</strong> Click and drag the blue node to move it
                  </p>
                  {neighbours.length > 0 && (
                    <p className="neighbours-count">
                      <strong>Neighbours:</strong> {neighbours.length} connected nodes shown in grey
                    </p>
                  )}
                  <p>
                    <strong>X Offset:</strong> {relX.toFixed(3)} units
                  </p>
                  <p>
                    <strong>Y Offset:</strong> {relY.toFixed(3)} units (not shown in 2D view)
                  </p>
                  <p>
                    <strong>Z Offset:</strong> {relZ.toFixed(3)} units
                  </p>
                  <p>
                    <strong>Distance:</strong> {Math.sqrt(relX * relX + relY * relY + relZ * relZ).toFixed(3)} units
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="actions-section">
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">Position updated successfully!</div>}
            <div className="action-buttons">
              <button onClick={handleReset} className="reset-btn" disabled={saving}>
                Reset
              </button>
              <button
                onClick={handleSave}
                className="save-btn"
                disabled={saving || loading}
              >
                {saving ? 'Saving...' : 'Save Position'}
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .other-node-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 16px;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }

        .header-left h3 {
          margin: 0 0 4px 0;
          color: #333;
          font-size: 18px;
        }

        .node-id {
          font-size: 12px;
          color: #666;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #666;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #f0f0f0;
          color: #333;
        }

        .info-section {
          margin-bottom: 24px;
        }

        .info-section h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 16px;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-item label {
          font-weight: 500;
          color: #666;
          min-width: 100px;
        }

        .info-item span {
          text-align: right;
          color: #333;
          word-break: break-word;
        }

        .position-display {
          display: flex;
          gap: 16px;
        }

        .position-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .position-label {
          font-size: 12px;
          color: #666;
          font-weight: 500;
        }

        .position-value {
          font-size: 16px;
          color: #333;
          font-family: monospace;
        }

        .position-editor {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .position-group {
          flex: 1;
          min-width: 200px;
        }

        .position-group h5 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 14px;
        }

        .input-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .input-group label {
          font-weight: 500;
          color: #666;
          min-width: 60px;
          font-size: 14px;
        }

        .input-group input {
          flex: 1;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: monospace;
        }

        .input-group input:focus {
          outline: none;
          border-color: #007bff;
        }

        .visualization-container {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .visualization-svg {
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          user-select: none;
        }

        .draggable-node {
          transition: r 0.1s;
        }

        .draggable-node:hover {
          r: 10;
        }

        .visualization-info {
          flex: 1;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }

        .visualization-info p {
          margin: 8px 0;
          font-size: 14px;
          color: #333;
        }

        .info-hint {
          padding: 8px;
          background: #e7f3ff;
          border-left: 3px solid #007bff;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .neighbours-count {
          padding: 6px;
          background: #f8f9fa;
          border-left: 3px solid #6c757d;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .visualization-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .visualization-header h4 {
          margin: 0;
        }

        .scale-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .scale-controls label {
          font-weight: 500;
          color: #666;
          font-size: 14px;
        }

        .scale-input-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .zoom-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          border: 1px solid #ddd;
          background: white;
          color: #333;
          border-radius: 4px;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .zoom-btn:hover {
          background: #f0f0f0;
          border-color: #007bff;
          color: #007bff;
        }

        .scale-slider {
          width: 150px;
          height: 6px;
          border-radius: 3px;
          background: #ddd;
          outline: none;
          cursor: pointer;
        }

        .scale-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #007bff;
          cursor: pointer;
        }

        .scale-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #007bff;
          cursor: pointer;
          border: none;
        }

        .scale-input {
          width: 70px;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: monospace;
          text-align: center;
        }

        .scale-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .reset-scale-btn {
          padding: 4px 12px;
          border: 1px solid #ddd;
          background: white;
          color: #666;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .reset-scale-btn:hover {
          background: #f0f0f0;
          border-color: #007bff;
          color: #007bff;
        }

        .scale-unit {
          font-size: 12px;
          color: #666;
        }

        .actions-section {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #eee;
        }

        .error-message {
          padding: 8px 12px;
          background: #f8d7da;
          color: #721c24;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .success-message {
          padding: 8px 12px;
          background: #d4edda;
          color: #155724;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .reset-btn,
        .save-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .reset-btn {
          background: #6c757d;
          color: white;
        }

        .reset-btn:hover:not(:disabled) {
          background: #545b62;
        }

        .save-btn {
          background: #28a745;
          color: white;
        }

        .save-btn:hover:not(:disabled) {
          background: #218838;
        }

        .reset-btn:disabled,
        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading,
        .error {
          text-align: center;
          padding: 32px 16px;
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

export default OtherNodeEditor
