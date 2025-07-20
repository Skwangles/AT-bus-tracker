import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Stage, Layer, Image as KonvaImage, Circle, Line, Rect } from 'react-konva'
import FileUpload from './FileUpload'
import NodeInspector from './NodeInspector'
import Toolbar from './Toolbar'
import { API_PREFIX, Edge, Node } from '../consts'
import { findPathWithDijkstra } from '../logic/pathfinding'
import { clamp } from '../logic/utils'
import {
  calculateCentroid,
  scalePoints,
  scalePointsX,
  scalePointsY,
  rotatePoints,
  translatePoints,
  flipPointsHorizontal,
  flipPointsVertical,
  applyTransformation
} from '../logic/transformations'

export interface FloorplanEditorProps {
  floorplan: string
}

const FloorplanEditor: React.FC<FloorplanEditorProps> = ({ floorplan }) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hasImage, setHasImage] = useState<boolean>(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [lastSelectedPoint, setLastSelectedPoint] = useState<Node | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showNodeInspector, setShowNodeInspector] = useState(false)

  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null)

  const [dragStartPos, setDragStartPos] = useState<{
    x: number
    y: number
  } | null>(null)

  const handleMultiplePointUpdate = async (points: any[]) => {
    try {
      await axios
        .post(`${API_PREFIX}/api/v1/authoring/maps/${floorplan}/updatemultiple`, {
          points: points.map(point => ({
            keyframe_id: point.keyframe_id,
            x: point.x,
            y: point.y,
            type: point.type
          }))
        });
      // fetchFloorplanData(); // Don't update the floorplan data after each point update
    } catch (error) {
      console.error('Error updating multiple points:', error);
    }
  };

  const fetchFloorplanData = async () => {
    try {
      const response = await axios.get<{
        has_image: boolean
        image: string
        edges: Array<{ keyframe_id0: number; keyframe_id1: number }>
        nodes: Array<{
          x: number
          y: number
          keyframe_id: number
          type: number
          labelCount: number
        }>
      }>(`${API_PREFIX}/api/v1/maps/${floorplan}`)
      if (
        !response.data ||
        !response.data.nodes ||
        !response.data.edges
      ) {
        console.error('No data returned from floorplan', floorplan, response.data, response)
        return
      }
      const img = new Image()
      if (floorplan) {
        img.src = `${API_PREFIX}/api/v1/maps/${floorplan}/image`
      }
      setHasImage(Boolean(response.data.has_image))
      img.onload = () => {
        setImage(img)
        setStageWidth(img.width)
        setStageHeight(img.height)
        
        // Calculate scale to fit the image within the container
        setTimeout(() => {
          if (canvasContainerRef.current) {
            const container = canvasContainerRef.current
            const containerWidth = container.clientWidth - 32 // Account for margins and padding
            const containerHeight = container.clientHeight - 32
            
            // Calculate scale to fit the image within the container
            const scaleX = containerWidth / img.width
            const scaleY = containerHeight / img.height
            const newScale = Math.min(scaleX, scaleY, 1) // Don't scale up, only down
            
            // Update stage dimensions to match the scaled size
            setStageWidth(img.width * newScale)
            setStageHeight(img.height * newScale)
          }
        }, 100)
      }
      setEdges(
        response.data.edges.map((edge) => ({
          id0: String(edge.keyframe_id0),
          id1: String(edge.keyframe_id1),
        }))
      )
      setNodes(
        response.data.nodes.map((node) => ({
          id: String(node.keyframe_id),
          ...node,
        }))
      )
    } catch (error) {
      console.error('Error fetching floorplan data:', error)
    }
  }

  useEffect(() => {
    setSelectedPoints(new Set())
    setSelectedNodeId(null)
    setShowNodeInspector(false)
    fetchFloorplanData()
  }, [floorplan])

  // Handle window resize to recalculate scale
  useEffect(() => {
    const handleResize = () => {
      if (image && canvasContainerRef.current) {
        const container = canvasContainerRef.current
        const containerWidth = container.clientWidth - 32
        const containerHeight = container.clientHeight - 32
        
        const scaleX = containerWidth / image.width
        const scaleY = containerHeight / image.height
        const newScale = Math.min(scaleX, scaleY, 1)
        
        setStageWidth(image.width * newScale)
        setStageHeight(image.height * newScale)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [image])

  const handleDragStart = (e: any) => {
    const { x, y } = e.target.position()
    setDragStartPos({ x, y })
  }

  const handleDragMove = (e: any) => {
    if (!dragStartPos) return

    const { x: x, y: y }: { x: number; y: number } = e.target.position()
    const dx = Number(x - dragStartPos.x)
    const dy = Number(y - dragStartPos.y)

    const width: number = stageWidth
    const height: number = stageHeight

    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (selectedPoints.has(node.id) && node.id != e.target.name()) {
          const newX = clamp(node.x + dx / width, 0, 1)
          const newY = clamp(node.y + dy / height, 0, 1)
          return { ...node, x: Number(newX), y: Number(newY) }
        } else if (node.id == e.target.name()) {
          return { ...node, x: Number(x / width), y: Number(y / height) }
        }
        return node
      })
    )

    setDragStartPos({ x, y })
  }

  // New Konva-based selection handlers
  const handleStageMouseDown = (e: any) => {
    // If clicking on a node, handle node selection
    if (e.target.name()) {
      const id = e.target.name()
      const foundNode = nodes.find((node) => String(node.id) === String(id))
      const isCtrlPressed = e.evt.ctrlKey
      const isShiftPressed = e.evt.shiftKey

      if (isCtrlPressed) {
        setSelectedPoints((prev) => {
          const newSelected = new Set(prev)
          if (newSelected.has(id)) {
            newSelected.delete(id)
          } else {
            newSelected.add(id)
          }
          return newSelected
        })
      } else if (isShiftPressed && lastSelectedPoint) {
        const method = 1
        const selectedIds = findPathWithDijkstra(
          nodes,
          edges,
          lastSelectedPoint.id,
          id,
          method,
          true
        )
        setSelectedPoints((prev) => {
          const newSelected = new Set(prev)
          for (const id of selectedIds) {
            newSelected.add(id)
          }
          return newSelected
        })
      } else {
        setSelectedPoints(new Set([id]))
        setSelectedNodeId(id)
        setShowNodeInspector(true)
      }
      setLastSelectedPoint(foundNode || null)
    } else {
      // Start selection box
      const pos = e.target.getStage().getPointerPosition()
      setIsSelecting(true)
      setSelectionStart(pos)
      setSelectionEnd(pos)
      
      // Clear selection if not holding Ctrl
      if (!e.evt.ctrlKey) {
        setSelectedPoints(new Set())
        setSelectedNodeId(null)
        setShowNodeInspector(false)
      }
    }
  }

  const handleStageMouseMove = (e: any) => {
    if (!isSelecting) return
    
    const pos = e.target.getStage().getPointerPosition()
    setSelectionEnd(pos)
  }

  const handleStageMouseUp = () => {
    if (isSelecting) {
      // Complete selection box
      if (selectionStart && selectionEnd) {
        const selectedIds = new Set<string>()
        
        nodes.forEach(node => {
          const nodeX = node.x * stageWidth
          const nodeY = node.y * stageHeight
          
          const left = Math.min(selectionStart.x, selectionEnd.x)
          const right = Math.max(selectionStart.x, selectionEnd.x)
          const top = Math.min(selectionStart.y, selectionEnd.y)
          const bottom = Math.max(selectionStart.y, selectionEnd.y)
          
          if (nodeX >= left && nodeX <= right && nodeY >= top && nodeY <= bottom) {
            selectedIds.add(node.id)
          }
        })
        
        setSelectedPoints(selectedIds)
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0]
          setSelectedNodeId(id)
          setShowNodeInspector(true)
        } else {
          setSelectedNodeId(null)
          setShowNodeInspector(false)
        }
      }
      
      setIsSelecting(false)
      setSelectionStart(null)
      setSelectionEnd(null)
    }
    
    // Handle drag updates
    if (dragStartPos && selectedPoints.size > 0) {
      const selectedNodes = nodes.filter((node) =>
        selectedPoints.has(node.id)
      )
      handleMultiplePointUpdate(selectedNodes)
    }
    setDragStartPos(null)
  }

  const getNodeCoords = (id: string) => {
    const node = nodes.find((n) => n.id === id)
    if (!node) return { x: 0, y: 0 }
    return { x: node.x, y: node.y }
  }

  const handleNodeUpdate = () => {
    fetchFloorplanData()
  }

  const handleImageUploadSuccess = () => {
    fetchFloorplanData()
  }

  // Transformation handlers
  const handleScaleAll = (factor: number) => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      scalePoints(points, factor, centroid.x, centroid.y)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleScaleSelected = (factor: number) => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const scaled = scalePoints([node], factor, centroid.x, centroid.y)[0]
        return applyTransformation([scaled], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleScaleXAll = (factor: number) => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      scalePointsX(points, factor, centroid.x)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleScaleXSelected = (factor: number) => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const scaled = scalePointsX([node], factor, centroid.x)[0]
        return applyTransformation([scaled], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleScaleYAll = (factor: number) => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      scalePointsY(points, factor, centroid.y)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleScaleYSelected = (factor: number) => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const scaled = scalePointsY([node], factor, centroid.y)[0]
        return applyTransformation([scaled], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleRotateAll = (angle: number) => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      rotatePoints(points, angle, centroid.x, centroid.y)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleRotateSelected = (angle: number) => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const rotated = rotatePoints([node], angle, centroid.x, centroid.y)[0]
        return applyTransformation([rotated], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleMoveAll = (dx: number, dy: number) => {
    if (nodes.length === 0) return
    
    const transformedNodes = applyTransformation(nodes, (points) =>
      translatePoints(points, dx, dy)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleMoveSelected = (dx: number, dy: number) => {
    if (selectedPoints.size === 0) return
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const moved = translatePoints([node], dx, dy)[0]
        return applyTransformation([moved], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleFlipAllHorizontal = () => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      flipPointsHorizontal(points, centroid.x)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleFlipSelectedHorizontal = () => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const flipped = flipPointsHorizontal([node], centroid.x)[0]
        return applyTransformation([flipped], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleFlipAllVertical = () => {
    if (nodes.length === 0) return
    
    const centroid = calculateCentroid(nodes)
    const transformedNodes = applyTransformation(nodes, (points) =>
      flipPointsVertical(points, centroid.y)
    )
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const handleFlipSelectedVertical = () => {
    if (selectedPoints.size === 0) return
    
    const selectedNodes = nodes.filter(node => selectedPoints.has(node.id))
    const centroid = calculateCentroid(selectedNodes)
    
    const transformedNodes = nodes.map(node => {
      if (selectedPoints.has(node.id)) {
        const flipped = flipPointsVertical([node], centroid.y)[0]
        return applyTransformation([flipped], points => points)[0]
      }
      return node
    })
    
    setNodes(transformedNodes)
    handleMultiplePointUpdate(transformedNodes)
  }

  const getNodeColor = (node: Node) => {
    if (selectedPoints.has(node.id)) {
      return '#ff0000'
    }
    
    // If node has labels, show it in a special colour regardless of type
    if (node.labelCount && node.labelCount > 0) {
      return '#9c27b0' // Purple for nodes with labels
    }
    
    // Color based on node type
    const nodeTypes = {
      0: '#00ff00', // Normal - Green
      1: '#28a745', // Elevator - Dark Green
      2: '#ffc107', // Toilet - Yellow
      3: '#17a2b8', // Info - Cyan
      4: '#6f42c1', // Stair - Purple
      5: '#dc3545', // Exit - Red
      50: '#ff6b35' // Border nodes - Orange
    }
    
    return nodeTypes[node.type as keyof typeof nodeTypes] || '#00ff00'
  }

  const getNodeRadius = (node: Node) => {
    if (selectedPoints.has(node.id)) {
      return 8
    }
    return 5
  }

  return (
    <div className="floorplan-editor">
      <div className="editor-header">
        <div className="header-left">
          <h2>{floorplan}</h2>
          <div className="stats">
            <span>{nodes.length} points</span>
            <span>{edges.length} connections</span>
          </div>
        </div>
        <div className="header-right">
          <FileUpload 
            currentFloor={floorplan} 
            isImageSelected={hasImage}
            onUploadSuccess={handleImageUploadSuccess}
          />
        </div>
      </div>

      <div className="editor-content">
        <div className="canvas-container" ref={canvasContainerRef}>
          <Stage
            width={stageWidth}
            height={stageHeight}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            <Layer ref={layer}>
              {hasImage && image && (
                <KonvaImage
                  image={image}
                  width={stageWidth}
                  height={stageHeight}
                />
              )}
              {edges.map((edge, i) => {
                const start = getNodeCoords(edge.id0)
                const end = getNodeCoords(edge.id1)
                return (
                  <Line
                    key={i}
                    points={[
                      start.x * stageWidth,
                      start.y * stageHeight,
                      end.x * stageWidth,
                      end.y * stageHeight,
                    ]}
                    stroke="#000"
                    strokeWidth={1}
                  />
                )
              })}
              {nodes.map((node) => (
                <Circle
                  key={node.id}
                  name={node.id}
                  x={node.x * stageWidth}
                  y={node.y * stageHeight}
                  radius={getNodeRadius(node)}
                  fill={getNodeColor(node)}
                  stroke={selectedPoints.has(node.id) ? '#000' : 'transparent'}
                  strokeWidth={2}
                  draggable
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleStageMouseUp}
                />
              ))}
              
              {/* Selection Box */}
              {isSelecting && selectionStart && selectionEnd && (
                <Rect
                  x={Math.min(selectionStart.x, selectionEnd.x)}
                  y={Math.min(selectionStart.y, selectionEnd.y)}
                  width={Math.abs(selectionEnd.x - selectionStart.x)}
                  height={Math.abs(selectionEnd.y - selectionStart.y)}
                  stroke="#007bff"
                  strokeWidth={2}
                  dash={[5, 5]}
                  fill="rgba(0, 123, 255, 0.1)"
                />
              )}
            </Layer>
          </Stage>
        </div>

        <div className="side-panels">
          <div className="toolbar-container">
            <Toolbar
              onScaleAll={handleScaleAll}
              onScaleSelected={handleScaleSelected}
              onScaleXAll={handleScaleXAll}
              onScaleXSelected={handleScaleXSelected}
              onScaleYAll={handleScaleYAll}
              onScaleYSelected={handleScaleYSelected}
              onRotateAll={handleRotateAll}
              onRotateSelected={handleRotateSelected}
              onMoveAll={handleMoveAll}
              onMoveSelected={handleMoveSelected}
              onFlipAllHorizontal={handleFlipAllHorizontal}
              onFlipSelectedHorizontal={handleFlipSelectedHorizontal}
              onFlipAllVertical={handleFlipAllVertical}
              onFlipSelectedVertical={handleFlipSelectedVertical}
              hasSelection={selectedPoints.size > 0}
              selectedPoints={selectedPoints}
              floorplan={floorplan}
              onDataRefresh={fetchFloorplanData}
            />
          </div>

          {showNodeInspector && selectedNodeId && (
            <div className="inspector-panel">
              <NodeInspector
                nodeId={selectedNodeId}
                onNodeUpdate={handleNodeUpdate}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .floorplan-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f5f5f5;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border-bottom: 1px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header-left h2 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 24px;
        }

        .stats {
          display: flex;
          gap: 16px;
          color: #666;
          font-size: 14px;
        }

        .editor-content {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }

        .canvas-container {
          flex: 1;
          position: relative;
          background: white;
          border: 1px solid #ddd;
          margin: 16px;
          border-radius: 8px;
          overflow: auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          min-height: 0;
        }

        .side-panels {
          display: flex;
          flex-direction: column;
          width: 400px;
          min-width: 400px;
          overflow-y: auto;
          padding: 16px;
          height: 100%;
        }

        .toolbar-container {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .inspector-panel {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          width: 100%;
        }

        @media (max-width: 1200px) {
          .editor-content {
            flex-direction: column;
          }

          .side-panels {
            width: auto;
            min-width: auto;
            flex-direction: row;
            overflow-x: auto;
          }

          .inspector-panel {
            width: 400px;
            min-width: 400px;
            margin: 0 16px 16px 16px;
          }
        }

        @media (max-width: 768px) {
          .side-panels {
            flex-direction: column;
          }

          .inspector-panel {
            width: auto;
            min-width: auto;
          }
        }
      `}</style>
    </div>
  )
}

export default FloorplanEditor
