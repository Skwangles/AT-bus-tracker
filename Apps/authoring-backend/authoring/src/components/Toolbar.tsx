import React, { useState } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'

export interface ToolbarProps {
  onScaleAll: (factor: number) => void
  onScaleSelected: (factor: number) => void
  onScaleXAll: (factor: number) => void
  onScaleXSelected: (factor: number) => void
  onScaleYAll: (factor: number) => void
  onScaleYSelected: (factor: number) => void
  onRotateAll: (angle: number) => void
  onRotateSelected: (angle: number) => void
  onMoveAll: (dx: number, dy: number) => void
  onMoveSelected: (dx: number, dy: number) => void
  onFlipAllHorizontal: () => void
  onFlipSelectedHorizontal: () => void
  onFlipAllVertical: () => void
  onFlipSelectedVertical: () => void
  hasSelection: boolean
  selectedPoints: Set<string>
  floorplan: string
  onDataRefresh: () => void
}

// Helper function to handle axios errors
const handleAxiosError = (error: unknown, defaultMessage: string): string => {
  if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response) {
    if (error.response.status === 409) {
      return 'Points are not on the same level or may already be connected'
    }
  }
  return error instanceof Error ? error.message : defaultMessage
}

const Toolbar: React.FC<ToolbarProps> = ({
  onScaleAll,
  onScaleSelected,
  onScaleXAll,
  onScaleXSelected,
  onScaleYAll,
  onScaleYSelected,
  onRotateAll,
  onRotateSelected,
  onMoveAll,
  onMoveSelected,
  onFlipAllHorizontal,
  onFlipSelectedHorizontal,
  onFlipAllVertical,
  onFlipSelectedVertical,
  hasSelection,
  selectedPoints,
  floorplan,
  onDataRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'transform' | 'connect'>('transform')
  const [connectPoint1, setConnectPoint1] = useState<string>('')
  const [connectPoint2, setConnectPoint2] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const scaleFactor = 1.1
  const rotationAngle = 15 // degrees
  const moveDistance = 0.01 // relative to image size

  const handleConnectPoints = async () => {
    if (!connectPoint1 || !connectPoint2) {
      alert('Please enter both point IDs')
      return
    }

    const id1 = Number(connectPoint1)
    const id2 = Number(connectPoint2)

    if (isNaN(id1) || isNaN(id2)) {
      alert('Please enter valid numeric point IDs')
      return
    }

    if (id1 === id2) {
      alert('Cannot connect a point to itself')
      return
    }

    setIsLoading(true)
    try {
      const response = await axios.post(
        `${API_PREFIX}/api/v1/authoring/point/${id1}/connect/${id2}`
      )
      
      if (response.status === 201) {
        alert(`Successfully connected points ${id1} and ${id2}`)
        setConnectPoint1('')
        setConnectPoint2('')
        onDataRefresh()
      } else {
        alert(`Failed to connect points: ${response.statusText}`)
      }
    } catch (error: unknown) {
      const errorMessage = handleAxiosError(error, 'Error connecting points')
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnectPoints = async () => {
    if (!connectPoint1 || !connectPoint2) {
      alert('Please enter both point IDs')
      return
    }

    const id1 = Number(connectPoint1)
    const id2 = Number(connectPoint2)

    if (isNaN(id1) || isNaN(id2)) {
      alert('Please enter valid numeric point IDs')
      return
    }

    if (id1 === id2) {
      alert('Cannot disconnect a point from itself')
      return
    }

    setIsLoading(true)
    try {
      const response = await axios.delete(
        `${API_PREFIX}/api/v1/authoring/point/${id1}/connect/${id2}`
      )
      
      if (response.status === 201) {
        alert(`Successfully disconnected points ${id1} and ${id2}`)
        setConnectPoint1('')
        setConnectPoint2('')
        onDataRefresh()
      } else {
        alert(`Failed to disconnect points: ${response.statusText}`)
      }
    } catch (error: unknown) {
      const errorMessage = handleAxiosError(error, 'Points are not connected')
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleHideSelectedPoints = async () => {
    if (selectedPoints.size === 0) {
      alert('Please select at least one point to hide')
      return
    }

    if (!confirm(`Are you sure you want to hide ${selectedPoints.size} selected point(s)?`)) {
      return
    }

    setIsLoading(true)
    try {
      const promises = Array.from(selectedPoints).map(pointId =>
        axios.delete(`${API_PREFIX}/api/v1/maps/${floorplan}/points`, {
          data: { keyframe_id: Number(pointId) }
        })
      )

      await Promise.all(promises)
      alert(`Successfully hidden ${selectedPoints.size} point(s)`)
      onDataRefresh()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error hiding points'
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectSelectedPoints = async () => {
    if (selectedPoints.size !== 2) {
      alert('Please select exactly 2 points to connect')
      return
    }

    const [id1, id2] = Array.from(selectedPoints)
    
    setIsLoading(true)
    try {
      const response = await axios.post(
        `${API_PREFIX}/api/v1/authoring/point/${id1}/connect/${id2}`
      )
      
      if (response.status === 201) {
        alert(`Successfully connected points ${id1} and ${id2}`)
        onDataRefresh()
      } else {
        alert(`Failed to connect points: ${response.statusText}`)
      }
    } catch (error: unknown) {
      const errorMessage = handleAxiosError(error, 'Error connecting points')
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnectSelectedPoints = async () => {
    if (selectedPoints.size !== 2) {
      alert('Please select exactly 2 points to disconnect')
      return
    }

    const [id1, id2] = Array.from(selectedPoints)
    
    setIsLoading(true)
    try {
      const response = await axios.delete(
        `${API_PREFIX}/api/v1/authoring/point/${id1}/connect/${id2}`
      )
      
      if (response.status === 201) {
        alert(`Successfully disconnected points ${id1} and ${id2}`)
        onDataRefresh()
      } else {
        alert(`Failed to disconnect points: ${response.statusText}`)
      }
    } catch (error: unknown) {
      const errorMessage = handleAxiosError(error, 'Points are not connected')
      alert(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-tabs">
        <button 
          className={`tab-button ${activeTab === 'transform' ? 'active' : ''}`}
          onClick={() => setActiveTab('transform')}
        >
          Transform
        </button>
        <button 
          className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
        >
          Connect & Hide
        </button>
      </div>

      {activeTab === 'transform' && (
        <div className="tab-content">
          <div className="toolbar-section">
            <h3>Scale Operations</h3>
            <div className="toolbar-group">
              <button onClick={() => onScaleAll(scaleFactor)} title="Scale all points up">
                Scale All Up
              </button>
              <button onClick={() => onScaleAll(1 / scaleFactor)} title="Scale all points down">
                Scale All Down
              </button>
              {hasSelection && (
                <>
                  <button onClick={() => onScaleSelected(scaleFactor)} title="Scale selected points up">
                    Scale Selected Up
                  </button>
                  <button onClick={() => onScaleSelected(1 / scaleFactor)} title="Scale selected points down">
                    Scale Selected Down
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="toolbar-section">
            <h3>X-Axis Scale</h3>
            <div className="toolbar-group">
              <button onClick={() => onScaleXAll(scaleFactor)} title="Scale X-axis of all points up">
                Scale X All Up
              </button>
              <button onClick={() => onScaleXAll(1 / scaleFactor)} title="Scale X-axis of all points down">
                Scale X All Down
              </button>
              {hasSelection && (
                <>
                  <button onClick={() => onScaleXSelected(scaleFactor)} title="Scale X-axis of selected points up">
                    Scale X Selected Up
                  </button>
                  <button onClick={() => onScaleXSelected(1 / scaleFactor)} title="Scale X-axis of selected points down">
                    Scale X Selected Down
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Y-Axis Scale</h3>
            <div className="toolbar-group">
              <button onClick={() => onScaleYAll(scaleFactor)} title="Scale Y-axis of all points up">
                Scale Y All Up
              </button>
              <button onClick={() => onScaleYAll(1 / scaleFactor)} title="Scale Y-axis of all points down">
                Scale Y All Down
              </button>
              {hasSelection && (
                <>
                  <button onClick={() => onScaleYSelected(scaleFactor)} title="Scale Y-axis of selected points up">
                    Scale Y Selected Up
                  </button>
                  <button onClick={() => onScaleYSelected(1 / scaleFactor)} title="Scale Y-axis of selected points down">
                    Scale Y Selected Down
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Rotation</h3>
            <div className="toolbar-group">
              <button onClick={() => onRotateAll(rotationAngle)} title="Rotate all points clockwise">
                Rotate All CW
              </button>
              <button onClick={() => onRotateAll(-rotationAngle)} title="Rotate all points counter-clockwise">
                Rotate All CCW
              </button>
              {hasSelection && (
                <>
                  <button onClick={() => onRotateSelected(rotationAngle)} title="Rotate selected points clockwise">
                    Rotate Selected CW
                  </button>
                  <button onClick={() => onRotateSelected(-rotationAngle)} title="Rotate selected points counter-clockwise">
                    Rotate Selected CCW
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Movement</h3>
            <div className="toolbar-group">
              <button onClick={() => onMoveAll(-moveDistance, 0)} title="Move all points left">
                Move All Left
              </button>
              <button onClick={() => onMoveAll(moveDistance, 0)} title="Move all points right">
                Move All Right
              </button>
              <button onClick={() => onMoveAll(0, -moveDistance)} title="Move all points up">
                Move All Up
              </button>
              <button onClick={() => onMoveAll(0, moveDistance)} title="Move all points down">
                Move All Down
              </button>
              {hasSelection && (
                <>
                  <button onClick={() => onMoveSelected(-moveDistance, 0)} title="Move selected points left">
                    Move Selected Left
                  </button>
                  <button onClick={() => onMoveSelected(moveDistance, 0)} title="Move selected points right">
                    Move Selected Right
                  </button>
                  <button onClick={() => onMoveSelected(0, -moveDistance)} title="Move selected points up">
                    Move Selected Up
                  </button>
                  <button onClick={() => onMoveSelected(0, moveDistance)} title="Move selected points down">
                    Move Selected Down
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Flip Operations</h3>
            <div className="toolbar-group">
              <button onClick={onFlipAllHorizontal} title="Flip all points horizontally">
                Flip All H
              </button>
              <button onClick={onFlipAllVertical} title="Flip all points vertically">
                Flip All V
              </button>
              {hasSelection && (
                <>
                  <button onClick={onFlipSelectedHorizontal} title="Flip selected points horizontally">
                    Flip Selected H
                  </button>
                  <button onClick={onFlipSelectedVertical} title="Flip selected points vertically">
                    Flip Selected V
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'connect' && (
        <div className="tab-content">
          <div className="toolbar-section">
            <h3>Connect Points</h3>
            <div className="toolbar-group">
              <div className="input-group">
                <label>Point 1 ID:</label>
                <input
                  type="text"
                  value={connectPoint1}
                  onChange={(e) => setConnectPoint1(e.target.value)}
                  placeholder="e.g. 123"
                  disabled={isLoading}
                />
              </div>
              <div className="input-group">
                <label>Point 2 ID:</label>
                <input
                  type="text"
                  value={connectPoint2}
                  onChange={(e) => setConnectPoint2(e.target.value)}
                  placeholder="e.g. 456"
                  disabled={isLoading}
                />
              </div>
              <button 
                onClick={handleConnectPoints}
                disabled={isLoading || !connectPoint1 || !connectPoint2}
                title="Connect two points by ID"
              >
                {isLoading ? 'Connecting...' : 'Connect Points'}
              </button>
              <button 
                onClick={handleDisconnectPoints}
                disabled={isLoading || !connectPoint1 || !connectPoint2}
                title="Disconnect two points by ID"
              >
                {isLoading ? 'Disconnecting...' : 'Disconnect Points'}
              </button>
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Selected Points Operations</h3>
            <div className="toolbar-group">
              <button 
                onClick={handleConnectSelectedPoints}
                disabled={isLoading || selectedPoints.size !== 2}
                title="Connect the two selected points"
              >
                {isLoading ? 'Connecting...' : `Connect Selected (${selectedPoints.size})`}
              </button>
              <button 
                onClick={handleDisconnectSelectedPoints}
                disabled={isLoading || selectedPoints.size !== 2}
                title="Disconnect the two selected points"
              >
                {isLoading ? 'Disconnecting...' : `Disconnect Selected (${selectedPoints.size})`}
              </button>
              <button 
                onClick={handleHideSelectedPoints}
                disabled={isLoading || selectedPoints.size === 0}
                title="Hide all selected points from the map"
                className="danger-button"
              >
                {isLoading ? 'Hiding...' : `Hide Selected (${selectedPoints.size})`}
              </button>
            </div>
          </div>

          <div className="toolbar-section">
            <h3>Selection Info</h3>
            <div className="selection-info">
              <p>Selected Points: {selectedPoints.size}</p>
              {selectedPoints.size > 0 && (
                <div className="selected-ids">
                  <strong>IDs:</strong> {Array.from(selectedPoints).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .toolbar {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 0;
          margin: 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          overflow-y: auto;
          height: 100%;
        }

        .toolbar-tabs {
          display: flex;
          border-bottom: 1px solid #ddd;
          background: #f8f9fa;
        }

        .tab-button {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #495057;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          background: #e9ecef;
        }

        .tab-button.active {
          background: white;
          color: #007bff;
          border-bottom: 2px solid #007bff;
        }

        .tab-content {
          padding: 16px;
          overflow-y: auto;
          max-height: calc(100vh - 200px);
        }

        .toolbar-section {
          margin-bottom: 20px;
        }

        .toolbar-section h3 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
        }

        .toolbar-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px;
        }

        .toolbar-group button {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #495057;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          text-align: center;
        }

        .toolbar-group button:hover:not(:disabled) {
          background: #e9ecef;
          border-color: #adb5bd;
          color: #212529;
        }

        .toolbar-group button:active:not(:disabled) {
          background: #dee2e6;
          transform: translateY(1px);
        }

        .toolbar-group button:disabled {
          background: #f8f9fa;
          color: #adb5bd;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .toolbar-group button.danger-button {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }

        .toolbar-group button.danger-button:hover:not(:disabled) {
          background: #c82333;
          border-color: #bd2130;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-group label {
          font-size: 12px;
          font-weight: 500;
          color: #495057;
        }

        .input-group input {
          padding: 6px 8px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          font-size: 12px;
        }

        .input-group input:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .selection-info {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          padding: 12px;
        }

        .selection-info p {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #495057;
        }

        .selected-ids {
          font-size: 12px;
          color: #6c757d;
          word-break: break-all;
        }

        @media (max-width: 768px) {
          .toolbar {
            margin: 8px;
            padding: 0;
          }

          .tab-content {
            padding: 12px;
          }

          .toolbar-group {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 6px;
          }

          .toolbar-group button {
            padding: 6px 8px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}

export default Toolbar 