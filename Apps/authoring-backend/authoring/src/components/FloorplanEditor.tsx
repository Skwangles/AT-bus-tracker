import React, { useState, useEffect, useRef, useReducer } from 'react'
import axios from 'axios'
import { Stage, Layer, Image as KonvaImage, Circle, Line } from 'react-konva'
import FileUpload from './FileUpload'
import PointControls from './PointControls'
import { API_PREFIX, Edge, Node } from '../consts'
import { findPathWithDijkstra } from '../logic/pathfinding'
import { padCordAwayFromEdge, clamp } from '../logic/utils'
import Buttons from './Buttons'

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
  const [, forceUpdate] = useReducer((x) => x + 1, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null)

  const [dragStartPos, setDragStartPos] = useState<{
    x: number
    y: number
  } | null>(null)

  const handlePointUpdate = async (point: any) => {
    try {
      await axios.post(`${API_PREFIX}/api/v1/maps/${floorplan}/update`, {
        keyframe_id: point.keyframe_id,
        x: point.x,
        y: point.y,
        type: point.type
      });
      fetchFloorplanData();
    } catch (error) {
      console.error('Error updating point:', error);
    }
  };

  const handleMultiplePointUpdate = async (points: any[]) => {
    try {
      await axios
        .post(`${API_PREFIX}/api/v1/maps/${floorplan}/updatemultiple`, {
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
        !response.data.edges ||
        !response.data.has_image
      ) {
        console.error('No data returned from floorplan', floorplan)
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
    fetchFloorplanData()
  }, [floorplan])

  const handleDragStart = (e: any) => {
    const { x, y } = e.target.position()
    setDragStartPos({ x, y })
  }

  const handleDragMove = (e: any) => {
    console.log(dragStartPos)
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
        const newSelected = prev
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
        for (const id of selectedIds) {
          prev.add(id)
        }
        return prev
      })
    } else {
      setSelectedPoints(new Set([id]))
    }
    setLastSelectedPoint(foundNode || null)
  }

  const handleMouseUp = (e: any) => {
    if (selectedPoints.size > 0) {
      const selectedNodes = nodes.filter((node) =>
        selectedPoints.has(node.id)
      )
      handleMultiplePointUpdate(selectedNodes)
    }
    setDragStartPos(null)
  }

  const updateAllPoints = (nodes: Node[]) => {
    setNodes(nodes)
    handleMultiplePointUpdate(nodes)
  }

  const getNodeCoords = (id: string) => {
    const node = nodes.find((n) => n.id === id)
    if (!node) return { x: 0, y: 0 }
    return { x: node.x, y: node.y }
  }

  const updateMap = (newNodes: Node[]) => {
    setNodes(newNodes)
    handleMultiplePointUpdate(newNodes)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <FileUpload currentFloor={floorplan} isImageSelected={hasImage} />
        {lastSelectedPoint && (
          <PointControls
            id={lastSelectedPoint.id}
            point={lastSelectedPoint}
            location={floorplan}
            reloadPoints={fetchFloorplanData}
          />
        )}
      </div>
      <div
        style={{
          border: '1px solid #ccc',
          margin: '20px 0',
          padding: '10px',
        }}
      >
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
                x={node.x * stageWidth}
                y={node.y * stageHeight}
                radius={5}
                fill={selectedPoints.has(node.id) ? '#ff0000' : '#00ff00'}
                draggable
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleMouseUp}
              />
            ))}
          </Layer>
        </Stage>
      </div>
      <Buttons
        nodes={nodes}
        selectedPoints={selectedPoints}
        updateMap={updateMap}
      />
    </div>
  )
}

export default FloorplanEditor
