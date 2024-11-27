import React, { useEffect, useState } from 'react'
import { Stage, Image as KonvaImage, Line, Circle, Layer } from 'react-konva'
import { Map as FeatherMap, X } from 'react-feather'
import {
  API_PREFIX,
  HIDE_EDGES,
  HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT,
  MAX_MAP_HEIGHT_PERCENT,
  USE_ORANGE_PERSON,
} from '../consts'
import '../css/Map.css'
import useImage from 'use-image'
import axios from 'axios'
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
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [stageWidth, setStageWidth] = useState<number>(800)
  const [stageHeight, setStageHeight] = useState<number>(800)

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
        const img = new Image()
        img.src = `${API_PREFIX}/api/floorplans/${floorName}/image`
        console.log('Has image', response.data)
        setHasImage(String(response.data.has_image) == 'true')
        img.onload = () => {
          setImage(img)
          const aspectRatio = img.width / img.height
          const maxHeight = MAX_MAP_HEIGHT_PERCENT * window.innerHeight
          const width = maxHeight * aspectRatio
          setStageWidth(width)
          setStageHeight(maxHeight)
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

    fetchFloorplanData()
  }, [floorName])

  const getNodeCoords = (id: string) => {
    const node = nodes.find((node) => node.id === id)
    if (!node) throw Error("Couldn't find node: " + id)
    return { x: node.x * stageWidth, y: node.y * stageHeight }
  }

  const handleMouseUp = (e: any) => {
    const id = e.target.name()
    if (isNaN(Number(id))) return
    setID(id)
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
                  <>
                    <KonvaImage
                      image={image}
                      width={stageWidth}
                      height={stageHeight}
                    />

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
                            strokeWidth={2}
                            lineCap="round"
                            lineJoin="round"
                          />
                        )
                      })}
                    {nodes
                      .filter((node) =>
                        HIDE_POINTS_ON_MAP_DURING_HIGHLIGHT &&
                        highlightedPoints.length > 0
                          ? highlightedPoints.includes(Number(node.id))
                          : true
                      )
                      .map((node) => {
                        if (String(node.id) === String(currentId)) {
                          const iconWidth = 15
                          const iconHeight = 30
                          return (
                            <KonvaImage
                              image={personImg}
                              width={iconWidth}
                              height={iconHeight}
                              key={node.id}
                              x={node.x * stageWidth - iconWidth / 2}
                              y={node.y * stageHeight - iconHeight / 2}
                              name={node.id}
                              onMouseUp={handleMouseUp}
                              onTouchEnd={handleMouseUp}
                            />
                          )
                        }

                        if (node.type >= 50) {
                          const iconWidth = 15
                          const iconHeight = 20
                          return (
                            <KonvaImage
                              image={
                                highlightedPoints.includes(Number(node.id))
                                  ? blueDoorImg
                                  : doorImg
                              }
                              width={iconWidth}
                              height={iconHeight}
                              key={node.id}
                              x={node.x * stageWidth - iconWidth / 2}
                              y={node.y * stageHeight - iconHeight / 2}
                              name={node.id}
                              onMouseUp={handleMouseUp}
                              onTouchEnd={handleMouseUp}
                            />
                          )
                        } else {
                          return (
                            <Circle
                              key={node.id}
                              x={node.x * stageWidth}
                              y={node.y * stageHeight}
                              radius={5}
                              fill={
                                String(node.id) === String(currentId)
                                  ? 'yellow'
                                  : highlightedPoints.includes(Number(node.id))
                                  ? 'blue'
                                  : 'red'
                              }
                              name={node.id}
                              onMouseUp={handleMouseUp}
                              onTouchEnd={handleMouseUp}
                            />
                          )
                        }
                      })}
                  </>
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
