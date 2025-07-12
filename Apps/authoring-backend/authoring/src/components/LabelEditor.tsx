import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'

// Define types for the props and label state
type LabelComponentProps = {
  id: number // The keyframe ID
}

type Label = {
  id: number;
  label: string;
  description: string;
  type: number;
}

const LabelComponent: React.FC<LabelComponentProps> = ({ id }) => {
  const [labels, setLabels] = useState<Label[]>([]) // Array to store the labels
  const [newLabel, setNewLabel] = useState<string>('') // For the new label input
  const [editingLabel, setEditingLabel] = useState<string | null>(null) // For the label being edited
  const [editedLabelText, setEditedLabelText] = useState<string>('') // Text input for editing label

  // Fetch the labels when the component mounts
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await axios.get(`${API_PREFIX}/api/v1/labels/${id}`)
        setLabels(response.data.otherNodes || [])
      } catch (error) {
        console.error('Error fetching labels:', error)
      }
    }

    fetchLabels()
  }, [id])

  // Handle adding a new label
  const addLabel = async () => {
    if (newLabel.trim()) {
      try {
        await axios.post(`${API_PREFIX}/api/v1/labels/${id}`, {
          label: newLabel,
        })
        // Refresh labels after adding
        const response = await axios.get(`${API_PREFIX}/api/v1/labels/${id}`)
        setLabels(response.data.otherNodes || [])
        setNewLabel('') // Reset input field
      } catch (error) {
        console.error('Error adding label:', error)
      }
    }
  }

  // Handle deleting a label
  const deleteLabel = async (label: string) => {
    try {
      await axios.delete(`${API_PREFIX}/api/v1/labels/${id}`, {
        data: { label },
      })
      setLabels((prevLabels) =>
        prevLabels.filter((item) => item.label !== label)
      ) // Remove the label from the list
    } catch (error) {
      console.error('Error deleting label:', error)
    }
  }

  // Handle starting to edit a label
  const startEditing = (label: string) => {
    setEditingLabel(label)
    setEditedLabelText(label) // Set the label's text to the editing input
  }

  // Handle saving the edited label
  const saveEditedLabel = async () => {
    if (editedLabelText.trim() && editingLabel) {
      try {
        await axios.put(`${API_PREFIX}/api/v1/labels/${id}`, {
          old_label: editingLabel,
          new_label: editedLabelText,
        })
        setLabels((prevLabels) =>
          prevLabels.map((label) =>
            label.label === editingLabel
              ? { ...label, label: editedLabelText }
              : label
          )
        ) // Update the label in the list
        setEditingLabel(null) // Clear the editing state
      } catch (error) {
        console.error('Error saving edited label:', error)
      }
    }
  }

  return (
    <div>
      <h3>Labels for Keyframe ID: {id}</h3>
      <ul>
        {labels.map((label) => (
          <li key={label.id}>
            {editingLabel === label.label ? (
              <>
                <input
                  className="mx-2"
                  type="text"
                  value={editedLabelText}
                  onChange={(e) => setEditedLabelText(e.target.value)}
                />
                <button onClick={saveEditedLabel}>Save</button>
              </>
            ) : (
              <>
                <strong>{label.label}</strong>
                {label.description && label.description !== label.label && (
                  <span className="text-gray-600 ml-2">({label.description})</span>
                )}
                <span className="text-sm text-gray-500 ml-2">Type: {label.type}</span>
                <button
                  className="mx-2"
                  onClick={() => startEditing(label.label)}
                >
                  Edit
                </button>
              </>
            )}
            <button className="mx-2" onClick={() => deleteLabel(label.label)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <input
        type="text"
        value={newLabel}
        onChange={(e) => setNewLabel(e.target.value)}
        placeholder="Enter new label"
      />
      <button onClick={addLabel}>Add Label</button>
    </div>
  )
}

export default LabelComponent
