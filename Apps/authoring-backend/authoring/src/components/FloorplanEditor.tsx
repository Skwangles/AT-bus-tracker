import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva'
import FileUpload from './FileUpload'
import NodeInspector from './NodeInspector'
import SelectionBox from './SelectionBox'
import { API_PREFIX, Edge, Node } from '../consts'
import { findPathWithDijkstra } from '../logic/pathfinding'
import { clamp } from '../logic/utils'

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
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [lastSelectedPoint, setLastSelectedPoint] = useState<Node | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showNodeInspector, setShowNodeInspector] = useState(false)

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
      fetchFloorplanData();
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

  const handleDragStart = (e: any) => {
    const { x, y } = e.target.position()
    setDragStartPos({ x, y })
  }

  const handleDragMove = (e: any) => {
    if (!dragStartPos) return

    const { x: x, y: y }: { x: number; y: number } = e.target.position()
    const dx = Number(x - dragStartPos.x)
    const dy = Number(y - dragStartPos.y)

    const width: number = e.target.getStage().width()
    const height: number = e.target.getStage().height()

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

  const handleMouseDown = (e: any) => {
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
      const method = 1 // Change to vary dijkstra method - only 1 currently implemented

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
  }

  const handleMouseUp = () => {
    if (selectedPoints.size > 0) {
      const selectedNodes = nodes.filter((node) =>
        selectedPoints.has(node.id)
      )
      handleMultiplePointUpdate(selectedNodes)
    }
    setDragStartPos(null)
  }

  const handleSelectionChange = (selectedIds: Set<string>) => {
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

  const getNodeColor = (node: Node) => {
    if (selectedPoints.has(node.id)) {
      return '#ff0000'
    }
    
    // Color based on node type
    const nodeTypes = {
      0: '#00ff00', // Normal - Green
      1: '#28a745', // Elevator - Dark Green
      2: '#ffc107', // Toilet - Yellow
      3: '#17a2b8', // Info - Cyan
      4: '#6f42c1', // Stair - Purple
      5: '#dc3545'  // Exit - Red
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
        <div className="canvas-container">
          <SelectionBox onSelectionChange={handleSelectionChange}>
            <Stage
              width={stageWidth}
              height={stageHeight}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
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
                    data-point-id={node.id}
                    x={node.x * stageWidth}
                    y={node.y * stageHeight}
                    radius={getNodeRadius(node)}
                    fill={getNodeColor(node)}
                    stroke={selectedPoints.has(node.id) ? '#000' : 'transparent'}
                    strokeWidth={2}
                    draggable
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleMouseUp}
                  />
                ))}
              </Layer>
            </Stage>
          </SelectionBox>
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
        }

        .canvas-container {
          flex: 1;
          position: relative;
          background: white;
          border: 1px solid #ddd;
          margin: 16px;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .inspector-panel {
          width: 500px;
          margin: 16px 16px 16px 0;
          overflow-y: auto;
        }

        @media (max-width: 1200px) {
          .editor-content {
            flex-direction: column;
          }

          .inspector-panel {
            width: auto;
            margin: 0 16px 16px 16px;
          }
        }
      `}</style>
    </div>
  )
}

export default FloorplanEditor
