import React, { useEffect, useState } from 'react'
import { Stage, Line, Layer, Image as KonvaImage } from 'react-konva'
import { X } from 'react-feather'
import {
  API_PREFIX,
  HIDE_EDGES,
  HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT,
  MAX_MAP_HEIGHT_PERCENT,
} from '../consts'
import '../css/Map.css'
import axios from 'axios'
import useImage from 'use-image'

// Import the person image
import personImg from '../assets/person.png'

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

interface MinimapProps {
  floorName: string
  setID: any
  currentId: string
  highlightedPath: number[]
  isMobile: boolean
  closeDrawer: boolean
  setCloseDrawer: (value: boolean) => void
}

const Map: React.FC<MinimapProps> = ({
  floorName,
  setID,
  currentId,
  highlightedPath: highlightedPoints,
  isMobile,
  closeDrawer,
  setCloseDrawer,
}) => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hasImage, setHasImage] = useState<boolean>(false)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)

  const [image] = useImage(`${API_PREFIX}/api/floorplans/${floorName}/image`, 'Anonymous')

  useEffect(() => {
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
          }>
        }>(`${API_PREFIX}/api/floorplans/${floorName}`)
        if (
          !response.data ||
          !response.data.nodes ||
          !response.data.edges ||
          !response.data.has_image
        ) {
          console.error('No data returned from floorplan', floorName)
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
        console.error('Error fetching floorplan data:', error)
      }
    }

    fetchFloorplanData()
  }, [floorName])

  useEffect(() => {
    if (image) {
      const aspectRatio = image.width / image.height
      const maxHeight = MAX_MAP_HEIGHT_PERCENT * window.innerHeight
      const width = maxHeight * aspectRatio
      setStageWidth(width)
      setStageHeight(maxHeight)
    }
  }, [image])

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id)
    if (!node) throw Error("Couldn't find node: " + id)
    return { x: node.x * stageWidth, y: node.y * stageHeight }
  }

  const handleLineClick = (e: any, edge: Edge) => {
    const { x: x1, y: y1 } = getNodeCoords(edge.id0)
    const { x: x2, y: y2 } = getNodeCoords(edge.id1)
    const clickX = e.evt.layerX
    const clickY = e.evt.layerY

    // Calculate distances to determine the closest node
    const distanceToNode1 = Math.sqrt((clickX - x1) ** 2 + (clickY - y1) ** 2)
    const distanceToNode2 = Math.sqrt((clickX - x2) ** 2 + (clickY - y2) ** 2)

    const closestNodeId = distanceToNode1 < distanceToNode2 ? edge.id0 : edge.id1
    setID(closestNodeId)
  }

  return (
    <div
      className={`
        ${
          isMobile
            ? 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000]'
            : 'fixed left-0 top-0 z-[900] flex flex-col'
        }
        ${!closeDrawer ? 'hidden' : ''}
      `}
    >
      <button
        className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg z-50 flex items-center justify-center transition-all"
        onClick={() => setCloseDrawer(false)}
        aria-label="Close map"
      >
        <X className="w-5 h-5" aria-hidden="true" />
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
                : 'max-w-[400px]'
            }
          `}
          >
            <Stage
              width={stageWidth}
              height={stageHeight}
              style={{
                maxWidth: '100%',
                maxHeight: isMobile ? '85vh' : '70vh',
                transform: isMobile ? 'scale(0.95)' : 'none',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            >
              <Layer>
                {image && (
                  <KonvaImage
                    image={image}
                    width={stageWidth}
                    height={stageHeight}
                  />
                )}
                {edges
                  .filter((edge) =>
                    HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT &&
                    highlightedPoints.length > 0
                      ? highlightedPoints.includes(Number(edge.id0)) &&
                        highlightedPoints.includes(Number(edge.id1))
                      : true
                  )
                  .map((edge, index) => {
                    const { x: x1, y: y1 } = getNodeCoords(edge.id0)
                    const { x: x2, y: y2 } = getNodeCoords(edge.id1)
                    if (HIDE_EDGES) {
                      return <></>
                    }
                    return (
                      <Line
                        key={index}
                        points={[x1, y1, x2, y2]}
                        stroke="black"
                        strokeWidth={8} // Thicker line for better visibility
                        lineCap="round"
                        lineJoin="round"
                        onMouseEnter={(e) => e.target.stroke('blue')} // Highlight on hover
                        onMouseLeave={(e) => e.target.stroke('black')}
                        onClick={(e) => handleLineClick(e, edge)}
                      />
                    )
                  })}
                {currentId && (
                  <KonvaImage
                    image={personImg}
                    x={getNodeCoords(currentId).x - 15} // Adjust for icon width
                    y={getNodeCoords(currentId).y - 15} // Adjust for icon height
                    width={30} // Set icon width
                    height={30} // Set icon height
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
