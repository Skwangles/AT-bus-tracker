import React, { useEffect, useState } from 'react'
import {
  Stage,
  Line,
  Layer,
  Image as KonvaImage /*, Arrow */,
} from 'react-konva'
import { X } from 'react-feather'
import {
  API_PREFIX,
  HIDE_EDGES,
  HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT,
  MAP_LINE_COLOUR,
  MAP_LINE_HIGHLIGHT_COLOUR,
  MAP_LINE_WIDTH,
  MAX_MAP_HEIGHT_PERCENT,
} from '../../consts'
import '../../css/Map.css'
import axios from 'axios'
import useImage from 'use-image'

// Import the person image
import personImgPng from '../../assets/person.png'
import highlightedDoorImgPng from '../../assets/Door.png'
import doorImageSvg from '../../assets/Door.svg'

interface Node {
  id: string
  x: number
  y: number
  type: number
}

interface Edge {
  id0: string
  id1: string
}

interface MapProps {
  floorName: string
  setID: any
  currentId: string
  highlightedPoints: number[]
  isMobile: boolean
  closeDrawer: boolean
  setCloseDrawer: (value: boolean) => void
  hasImage: boolean
  setHasImage: (value: boolean) => void
  isPathfindingMode: boolean
}

const Map: React.FC<MapProps> = ({
  floorName,
  setID,
  currentId,
  highlightedPoints,
  isMobile,
  closeDrawer,
  setCloseDrawer,
  isPathfindingMode,
  setHasImage,
  hasImage,
}) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [mapNode, setMapNode] = useState<Node | null>(null)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)

  const [image] = useImage(
    `${API_PREFIX}/api/v1/floorplans/${floorName}/image`,
    'anonymous'
  )
  const [personImage] = useImage(personImgPng)
  const [highlightedDoorImage] = useImage(highlightedDoorImgPng)
  const [doorImage] = useImage(doorImageSvg)

  useEffect(() => {
    const mapNode = nodes.find((node) => Number(node.id) === Number(currentId))
    if (currentId && mapNode) {
      if (mapNode.type < 50) {
        setMapNode(mapNode)
      }
    }
  }, [currentId, nodes, floorName])

  useEffect(() => {
    if (!floorName || floorName == '') {
      setHasImage(false)
      setNodes([])
      setEdges([])
    }

    const fetchFloorplanData = async () => {
      if (!floorName || floorName == '') return

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
          }>
        }>(`${API_PREFIX}/api/v1/floorplans/${floorName}`)

        if (
          !response.data ||
          !response.data.nodes ||
          !response.data.edges ||
          !response.data.has_image
        ) {
          setHasImage(false)
          setNodes([])
          setEdges([])
          return
        }
        setHasImage(String(response.data.has_image) === 'true')
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
        setHasImage(false)
        setNodes([])
        setEdges([])
      }
    }

    fetchFloorplanData()
  }, [floorName])

  useEffect(() => {
    if (image) {
      const aspectRatio = image.width / image.height
      const maxHeight = Math.min(
        MAX_MAP_HEIGHT_PERCENT * window.innerHeight,
        window.innerHeight
      )
      const maxWidth = window.innerWidth * 0.9

      let width = maxHeight * aspectRatio
      let height = maxHeight

      // If width exceeds maxWidth, scale both dimensions down
      if (width > maxWidth) {
        width = maxWidth
        height = maxWidth / aspectRatio
      }

      setStageWidth(width)
      setStageHeight(height)
    }
  }, [image])

  const findNode = (id: string) => nodes.find((node) => node.id === id)

  const getNodeCoords = (id: string, node = findNode(id)) => {
    if (!node) return null
    return { x: node.x * stageWidth, y: node.y * stageHeight }
  }

  const handleLineClick = (e: any, edge: Edge) => {
    const node1 = findNode(edge.id0)
    const node2 = findNode(edge.id1)
    if (node1 === undefined || node2 === undefined) {
      // If nodes have been stripped, their edges may still exist.
      // Ignore these edges.
      return
    }

    const { x: x1, y: y1 } = getNodeCoords(edge.id0, node1)!
    const { x: x2, y: y2 } = getNodeCoords(edge.id1, node2)!
    const clickX = e.evt.layerX
    const clickY = e.evt.layerY

    // Calculate distances to determine the closest node
    const distanceToNode1 = Math.sqrt((clickX - x1) ** 2 + (clickY - y1) ** 2)
    const distanceToNode2 = Math.sqrt((clickX - x2) ** 2 + (clickY - y2) ** 2)

    const closestNodeId =
      distanceToNode1 < distanceToNode2 ? edge.id0 : edge.id1
    setID(closestNodeId)
  }

  return (
    <div
      className={`
        ${
          isMobile
            ? 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000]'
            : 'fixed left-0 top-0 z-[1000] flex flex-col'
        }
        ${!closeDrawer ? 'hidden' : ''}
      `}
    >
      <button
        className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg z-[1001] flex items-center justify-center transition-all"
        onClick={() => setCloseDrawer(false)}
        aria-label="Close map"
      >
        <X className="w-5 h-5" aria-hidden="true" color="black" />
      </button>

      <div
        className={`
          ${
            isMobile
              ? 'fixed inset-0 flex items-center justify-center p-4'
              : 'minimap-wrapper bg-white/90 backdrop-blur-sm rounded-lg shadow-lg m-2 p-2'
          }
        `}
      >
        {hasImage && (
          <div
            className={`
            relative
            ${
              isMobile
                ? 'w-full h-full flex items-center justify-center overflow-hidden'
                : 'max-w-[800px]'
            }
          `}
          >
            <Stage
              width={stageWidth}
              height={stageHeight}
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: isMobile ? '85vh' : '70vh',
                transform: isMobile ? 'scale(0.95)' : 'none',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Layer>
                {image && ( // background image
                  <KonvaImage
                    image={image}
                    width={stageWidth}
                    height={stageHeight}
                  />
                )}
                {edges
                  .filter((edge) =>
                    HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT && isPathfindingMode
                      ? highlightedPoints.includes(Number(edge.id0)) &&
                        highlightedPoints.includes(Number(edge.id1))
                      : true
                  )
                  .map((edge, index) => {
                    const node1 = findNode(edge.id0)
                    const node2 = findNode(edge.id1)
                    if (node1 === undefined || node2 === undefined) {
                      // If nodes have been stripped, their edges may still exist.
                      // Ignore these edges.
                      return <></>
                    }

                    const { x: x1, y: y1 } = getNodeCoords(edge.id0, node1)!
                    const { x: x2, y: y2 } = getNodeCoords(edge.id1, node2)!
                    if (HIDE_EDGES) {
                      return <></>
                    }
                    return (
                      <Line
                        key={index}
                        points={[x1, y1, x2, y2]}
                        stroke={MAP_LINE_COLOUR}
                        strokeWidth={MAP_LINE_WIDTH}
                        lineCap="round"
                        lineJoin="round"
                        onMouseEnter={(e) => {
                          const shape = e.target as any
                          shape.stroke(MAP_LINE_HIGHLIGHT_COLOUR)
                          shape.getLayer()?.batchDraw()
                        }}
                        onMouseLeave={(e) => {
                          const shape = e.target as any
                          shape.stroke(MAP_LINE_COLOUR)
                          shape.getLayer()?.batchDraw()
                        }}
                        onClick={(e) => handleLineClick(e, edge)}
                        onTouchStart={(e) => handleLineClick(e, edge)}
                      />
                    )
                  })}

                {nodes.length > 0 &&
                  nodes
                    .filter(
                      (node) =>
                        node.type >= 50 &&
                        (HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT
                          ? isPathfindingMode
                            ? highlightedPoints.includes(Number(node.id))
                            : true
                          : true)
                    )
                    .map((node) => (
                      <KonvaImage
                        key={node.id}
                        image={
                          highlightedPoints.includes(Number(node.id))
                            ? highlightedDoorImage
                            : doorImage
                        }
                        x={node.x * stageWidth - 5}
                        y={node.y * stageHeight - 15}
                        width={20}
                        height={30}
                        onClick={(e) => setID(node.id)}
                        onTouchStart={(e) => setID(node.id)}
                      />
                    ))}
                {/* The Person Image should be at the top level */}
                {mapNode &&
                  getNodeCoords(mapNode.id, mapNode) &&
                  personImage && (
                    <KonvaImage
                      image={personImage}
                      x={getNodeCoords(mapNode.id, mapNode)!.x - 10}
                      y={getNodeCoords(mapNode.id, mapNode)!.y - 20}
                      width={20}
                      height={40}
                    />
                  )}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </div>
  )
}

export default Map
