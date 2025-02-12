import { Node } from '../consts'
import {
  rotatePoints,
  flipPointsHorizontally,
  flipPointsVertically,
  rescalePoints,
  rescaleX,
  rescaleY,
  moveX,
  moveY,
  rotatePointsByAngle,
} from '../logic/tranformations'

export default function Buttons({
  nodes,
  selectedPoints,
  updateMap,
}: {
  nodes: Node[]
  selectedPoints: any
  updateMap: any
}) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div>
          <button
            onClick={() => rotatePoints(nodes, selectedPoints, updateMap)}
          >
            Rotate All Points 90 Degrees
          </button>
          <div>
            <button
              className="bg-blue-600"
              onClick={() =>
                rotatePointsByAngle(
                  nodes,
                  selectedPoints,
                  updateMap,
                  2,
                  0.5,
                  0.5
                )
              }
            >
              Rotate All CW 10 Degrees
            </button>
            <button
              className="bg-blue-600"
              onClick={() =>
                rotatePointsByAngle(
                  nodes,
                  selectedPoints,
                  updateMap,
                  -2,
                  0.5,
                  0.5
                )
              }
            >
              Rotate All CCW 10 Degrees
            </button>
          </div>
          <div>
            <button
              className="bg-orange-600"
              onClick={() =>
                flipPointsHorizontally(nodes, selectedPoints, updateMap)
              }
            >
              Flip All Points Horizontally
            </button>
            <button
              className="bg-orange-600"
              onClick={() =>
                flipPointsVertically(nodes, selectedPoints, updateMap)
              }
            >
              Flip All Points Vertically
            </button>
          </div>
          <div>
            <button
              className="bg-green-600"
              onClick={() => rescalePoints(nodes, updateMap, 1.1)}
            >
              Scale Up
            </button>
            <button
              className="bg-red-600"
              onClick={() => rescalePoints(nodes, updateMap, 0.9)}
            >
              Scale Down
            </button>
          </div>
          <div>
            <button
              className="bg-green-600"
              onClick={() => rescaleX(nodes, updateMap, 1.1)}
            >
              Scale X UP
            </button>
            <button
              className="bg-red-600"
              onClick={() => rescaleX(nodes, updateMap, 0.9)}
            >
              Scale X Down
            </button>
          </div>
          <div>
            <button
              className="bg-green-600"
              onClick={() => rescaleY(nodes, updateMap, 1.1)}
            >
              Scale Y UP
            </button>
            <button
              className="bg-red-600"
              onClick={() => rescaleY(nodes, updateMap, 0.9)}
            >
              Scale Y Down
            </button>
          </div>
          <div>
            <button onClick={() => moveX(nodes, updateMap, -0.01)}>
              Move Left
            </button>
            <button onClick={() => moveX(nodes, updateMap, 0.01)}>
              Move Right
            </button>
          </div>
          <div>
            <button onClick={() => moveY(nodes, updateMap, -0.01)}>
              Move Up
            </button>
            <button onClick={() => moveY(nodes, updateMap, 0.01)}>
              Move Down
            </button>
          </div>
        </div>
        <div>
          <button
            onClick={() => rotatePoints(nodes, selectedPoints, updateMap, true)}
          >
            Rotate Selected (Green) Points 90 Degrees
          </button>
          <button
            onClick={() =>
              flipPointsVertically(nodes, selectedPoints, updateMap, true)
            }
          >
            Flip Selected Points Vertically
          </button>
          <button
            onClick={() =>
              flipPointsHorizontally(nodes, selectedPoints, updateMap, true)
            }
          >
            Flip Selected Points Horizontally
          </button>
        </div>
      </div>
    </>
  )
}
