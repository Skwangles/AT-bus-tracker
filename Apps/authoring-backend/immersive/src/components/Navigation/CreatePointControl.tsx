import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../../consts'
import { ThreeNumbersArray, ReservedTypeIndex } from '../../types'
import { toast } from 'react-toastify'

interface CreatePointControlProps {
  currentPosition: ThreeNumbersArray
  currentLocation: string
  onPointCreated: (pointId: string) => void
  onCancel: () => void
  onPositionChange: (position: ThreeNumbersArray) => void
}

const CreatePointControl: React.FC<CreatePointControlProps> = ({
  currentPosition,
  currentLocation,
  onPointCreated,
  onCancel,
  onPositionChange,
}) => {
  const [pointType, setPointType] = useState<number>(ReservedTypeIndex.Anchor)
  const [pointLabel, setPointLabel] = useState<string>('')
  const [position, setPosition] = useState<ThreeNumbersArray>([
    ...currentPosition,
  ])
  const [elevatorShaftName, setElevatorShaftName] = useState<string>('')
  const [isCreating, setIsCreating] = useState<boolean>(false)

  // Update position state when it changes from props
  useEffect(() => {
    setPosition([...currentPosition])
  }, [currentPosition])

  // Adjust position by a small increment
  const adjustPosition = (axis: 'x' | 'y' | 'z', delta: number) => {
    const newPos = [...position] as ThreeNumbersArray
    if (axis === 'x') newPos[0] += delta
    if (axis === 'y') newPos[1] += delta
    if (axis === 'z') newPos[2] += delta

    setPosition(newPos)
    onPositionChange(newPos) // Notify parent component
  }

  // Format the label based on the point type
  const formatLabel = (
    type: number,
    label: string,
    shaftName: string
  ): string => {
    if (type === ReservedTypeIndex.Elevator && label) {
      // Format: "!!elevator, shaft_name, point_description"
      const shaft = shaftName.trim() || 'shaft1'
      return `!!elevator, ${shaft}, ${label}`
    } else if (type === ReservedTypeIndex.Toilet && label) {
      // Format: "!!toilet, description"
      return `!!toilet, ${label}`
    }
    return label
  }

  // Save the point to the backend
  const savePoint = async () => {
    if (!pointLabel.trim()) {
      toast.error('Please enter a label for the point')
      return
    }

    setIsCreating(true)

    try {
      const formattedLabel = formatLabel(
        pointType,
        pointLabel,
        elevatorShaftName
      )

      const response = await axios.post(`${API_PREFIX}/api/v1/point`, {
        x_trans: position[0],
        y_trans: position[1],
        z_trans: position[2],
        type: pointType,
        label: formattedLabel,
        location: currentLocation,
      })

      if (response.status === 201) {
        toast.success('Point created successfully')
        onPointCreated(response.data.keyframe_id)
      }
    } catch (error) {
      console.error('Error creating point:', error)
      toast.error('Failed to create point')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="create-point-control bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg w-80">
      <h3 className="text-lg font-semibold mb-4">Create New Point</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Point Type:</label>
        <select
          className="w-full p-2 border rounded"
          value={pointType}
          onChange={(e) => setPointType(Number(e.target.value))}
        >
          <option value={ReservedTypeIndex.Anchor}>Anchor</option>
          <option value={ReservedTypeIndex.Elevator}>Elevator</option>
          <option value={ReservedTypeIndex.Toilet}>Toilet</option>
          <option value={ReservedTypeIndex.MergePoint}>Merge Point</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Label/Description:
        </label>
        <input
          type="text"
          className="w-full p-2 border rounded"
          value={pointLabel}
          onChange={(e) => setPointLabel(e.target.value)}
          placeholder="Enter point description"
        />
      </div>

      {pointType === ReservedTypeIndex.Elevator && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Elevator Shaft Name:
          </label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={elevatorShaftName}
            onChange={(e) => setElevatorShaftName(e.target.value)}
            placeholder="e.g. shaft1"
          />
        </div>
      )}

      <div className="mb-4">
        <h4 className="text-md font-medium mb-2">Position Controls:</h4>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-center">X: {position[0].toFixed(2)}</div>
          <div className="text-center">Y: {position[1].toFixed(2)}</div>
          <div className="text-center">Z: {position[2].toFixed(2)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center">
            <button
              className="w-full bg-blue-500 text-white rounded p-1 mb-1"
              onClick={() => adjustPosition('x', 0.1)}
            >
              X +
            </button>
            <button
              className="w-full bg-blue-500 text-white rounded p-1"
              onClick={() => adjustPosition('x', -0.1)}
            >
              X -
            </button>
          </div>

          <div className="flex flex-col items-center">
            <button
              className="w-full bg-green-500 text-white rounded p-1 mb-1"
              onClick={() => adjustPosition('y', 0.1)}
            >
              Y +
            </button>
            <button
              className="w-full bg-green-500 text-white rounded p-1"
              onClick={() => adjustPosition('y', -0.1)}
            >
              Y -
            </button>
          </div>

          <div className="flex flex-col items-center">
            <button
              className="w-full bg-red-500 text-white rounded p-1 mb-1"
              onClick={() => adjustPosition('z', 0.1)}
            >
              Z +
            </button>
            <button
              className="w-full bg-red-500 text-white rounded p-1"
              onClick={() => adjustPosition('z', -0.1)}
            >
              Z -
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          className="bg-gray-500 text-white rounded px-4 py-2"
          onClick={onCancel}
          disabled={isCreating}
        >
          Cancel
        </button>
        <button
          className="bg-blue-600 text-white rounded px-4 py-2"
          onClick={savePoint}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Save Point'}
        </button>
      </div>
    </div>
  )
}

export default CreatePointControl
