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
      }>(`${API_PREFIX}/api/v1/floorplans/${floorplan}`)
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
        img.src = `${API_PREFIX}/api/v1/floorplans/${floorplan}/image`
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
      if (selectedPoints.size <= 1) {
        setSelectedPoints(new Set([id]))
      } else {
        setSelectedPoints((prev) => prev.add(id))
      }
    }

    setLastSelectedPoint(foundNode || null)
  }

  const handleMouseUp = (e: any) => {
    const x = e.target.x() / e.target.getStage().width()
    const y = e.target.y() / e.target.getStage().height()

    console.log('Finish pos:', x, y)
    setDragStartPos(null)

    for (const node of nodes.filter((node) => selectedPoints.has(node.id))) {
      axios.post(`${API_PREFIX}/api/v1/floorplans/${floorplan}/update`, {
        id: node.id,
        x: node.x,
        y: node.y,
      })
    }
  }

  const updateAllPoints = (nodes: Node[]) => {
    axios
      .post(`${API_PREFIX}/api/v1/floorplans/${floorplan}/updatemultiple`, {
        points: nodes,
      })
      .catch((e) => {
        console.error('Error occurred updating!', e)
      })
    console.log('Updated!')
  }

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id)
    if (!node) throw Error("Couldn't find node: " + id)
    return {
      x: padCordAwayFromEdge(node.x) * stageWidth,
      y: padCordAwayFromEdge(node.y) * stageHeight,
    }
  }

  const updateMap = (newNodes: Node[]) => {
    setNodes(newNodes)
    updateAllPoints(newNodes)
    forceUpdate()
  }

  return (
    <>
      <div>
        <FileUpload currentFloor={floorplan} isImageSelected={hasImage} />
        <Buttons
          nodes={nodes}
          selectedPoints={selectedPoints}
          updateMap={updateMap}
        />
        <div
          style={{
            border: 'solid 1px',
            borderRadius: '5px',
            width: 'fit-content',
          }}
        >
          {hasImage && (
            <Stage
              width={stageWidth}
              height={stageHeight}
              ref={layer}
              // draggable
              // onDragMove={handleDragMove}
              // onDragEnd={handleDragEnd}
            >
              <Layer>
                {image && nodes && (
                  <>
                    <KonvaImage
                      image={image}
                      width={stageWidth}
                      height={stageHeight}
                      onMouseDown={() => setSelectedPoints(new Set())}
                    />
                    {edges.map((edge, index) => {
                      const { x: x1, y: y1 } = getNodeCoords(edge.id0)
                      const { x: x2, y: y2 } = getNodeCoords(edge.id1)
                      return (
                        <Line
                          key={index}
                          points={[x1, y1, x2, y2]}
                          stroke="black"
                          strokeWidth={2}
                          lineCap="round"
                          lineJoin="round"
                        />
                      )
                    })}
                    {nodes &&
                      nodes.map((node) => (
                        <Circle
                          key={node.id}
                          x={padCordAwayFromEdge(node.x) * stageWidth}
                          y={padCordAwayFromEdge(node.y) * stageHeight}
                          radius={5}
                          fill={
                            selectedPoints.has(node.id)
                              ? 'green'
                              : node.labelCount && node.labelCount > 0
                              ? 'yellow'
                              : node.type < 50
                              ? 'red'
                              : 'blue'
                          }
                          name={node.id}
                          draggable
                          onMouseDown={handleMouseDown}
                          onTouchStart={handleMouseDown}
                          onMouseUp={handleMouseUp}
                          onTouchEnd={handleMouseUp}
                          onDragStart={handleDragStart}
                          onDragMove={handleDragMove}
                          // onDragEnd={handleDragEnd}
                        />
                      ))}
                  </>
                )}
              </Layer>
            </Stage>
          )}
        </div>
      </div>
      <div>
        <PointControls
          id={lastSelectedPoint?.id}
          point={lastSelectedPoint}
          location={floorplan}
          reloadPoints={() => {
            console.log('Reloading points')
            fetchFloorplanData()
          }}
        />
      </div>
    </>
  )
}

export default FloorplanEditor
