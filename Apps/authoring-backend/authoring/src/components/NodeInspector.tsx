import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { API_PREFIX } from '../consts'

interface NodeInfo {
  keyframe_id: number
  ts: string
  pose: number[]
  x_trans: number
  y_trans: number
  z_trans: number
  location: string
  labels: Array<{
    label: string
    description: string
    type: number
  }>
}

interface OtherNode {
  id: number
  ref_id: number
  label: string
  description: string
  info: string
  image: string
  type: number
  x_trans: number
  y_trans: number
  z_trans: number
}

interface NodeInspectorProps {
  nodeId: string | null
  onNodeUpdate?: () => void
}

const NodeInspector: React.FC<NodeInspectorProps> = ({
  nodeId,
  onNodeUpdate,
}) => {
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [otherNodes, setOtherNodes] = useState<OtherNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [showImage, setShowImage] = useState(false)
  const [editingOtherNode, setEditingOtherNode] = useState<OtherNode | null>(
    null
  )
  const [showCreateForm, setShowCreateForm] = useState(false)

  const nodeTypes = {
    0: { name: 'Normal', color: '#007bff', icon: '📍' },
    1: { name: 'Elevator', color: '#28a745', icon: '🛗' },
    2: { name: 'Toilet', color: '#ffc107', icon: '🚻' },
    3: { name: 'Info', color: '#17a2b8', icon: 'ℹ️' },
    4: { name: 'Stair', color: '#6f42c1', icon: '🪜' },
    5: { name: 'Exit', color: '#dc3545', icon: '🚪' },
    50: { name: 'Border', color: '#ff6b35', icon: '🔗' },
    labeled: { name: 'Labeled', color: '#9c27b0', icon: '🏷️' },
  }

  const fetchNodeInfo = async () => {
    if (!nodeId) return

    setLoading(true)
    setError(null)

    try {
      const response = await axios.get(`${API_PREFIX}/api/v1/point/${nodeId}`)
      setNodeInfo(response.data)

      // Fetch associated image
      try {
        const imageResponse = await axios.get(
          `${API_PREFIX}/api/v1/point/${nodeId}/image`,
          {
            responseType: 'blob',
          }
        )
        const imageBlob = new Blob([imageResponse.data], { type: 'image/jpeg' })
        setImageUrl(URL.createObjectURL(imageBlob))
      } catch (imageError) {
        console.log('No image available for this point')
        setImageUrl(null)
      }

      // Fetch other_nodes
      const labelsResponse = await axios.get(
        `${API_PREFIX}/api/v1/point/${nodeId}/labels`
      )
      setOtherNodes(labelsResponse.data.otherNodes || [])
    } catch (err) {
      console.error('Error fetching node info:', err)
      setError('Failed to load node information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNodeInfo()
  }, [nodeId])

  const handleCreateOtherNode = async (formData: {
    label: string
    description: string
    type: number
    x_offset?: number
    y_offset?: number
    z_offset?: number
  }) => {
    if (!nodeId) return

    try {
      await axios.post(`${API_PREFIX}/api/v1/point/${nodeId}/labels`, formData)
      setShowCreateForm(false)
      fetchNodeInfo() // Refresh data
      if (onNodeUpdate) onNodeUpdate()
    } catch (err) {
      console.error('Error creating other node:', err)
      setError('Failed to create label')
    }
  }

  const handleUpdateOtherNode = async (otherNode: OtherNode) => {
    try {
      await axios.put(`${API_PREFIX}/api/v1/point/${nodeId}/labels`, {
        old_label: otherNode.label,
        new_label: otherNode.label,
        description: otherNode.description,
        type: otherNode.type,
      })
      setEditingOtherNode(null)
      fetchNodeInfo() // Refresh data
      if (onNodeUpdate) onNodeUpdate()
    } catch (err) {
      console.error('Error updating other node:', err)
      setError('Failed to update label')
    }
  }

  const handleDeleteOtherNode = async (otherNodeId: number) => {
    if (!confirm('Are you sure you want to delete this label?')) return

    try {
      await axios.delete(`${API_PREFIX}/api/v1/labels/${otherNodeId}`)
      fetchNodeInfo() // Refresh data
      if (onNodeUpdate) onNodeUpdate()
    } catch (err) {
      console.error('Error deleting other node:', err)
      setError('Failed to delete label')
    }
  }

  if (!nodeId) {
    return (
      <div className="node-inspector">
        <div className="no-selection">
          <h3>Node Inspector</h3>
          <p>Select a node to view its details</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="node-inspector">
        <div className="loading">Loading node information...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="node-inspector">
        <div className="error">
          {error}
          <button onClick={fetchNodeInfo} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!nodeInfo) {
    return (
      <div className="node-inspector">
        <div className="error">Node not found</div>
      </div>
    )
  }

  return (
    <div className="node-inspector">
      <div className="inspector-header">
        <div className="header-left">
          <h3>Node {nodeId}</h3>
          {otherNodes.length > 0 && (
            <span className="label-indicator">
              🏷️ {otherNodes.length} label{otherNodes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="add-label-btn"
        >
          {showCreateForm ? 'Cancel' : 'Add Label'}
        </button>
      </div>

      {/* Basic Node Information */}
      <div className="info-section">
        <h4>Basic Information</h4>
        <div className="info-grid">
          <div className="info-item">
            <label>Location:</label>
            <span>{nodeInfo.location}</span>
          </div>
          <div className="info-item">
            <label>Timestamp:</label>
            <span>{new Date(Number(nodeInfo.ts)).toLocaleString()}</span>
          </div>
          <div className="info-item">
            <label>X Position:</label>
            <span>{nodeInfo.x_trans.toFixed(3)}</span>
          </div>
          <div className="info-item">
            <label>Y Position:</label>
            <span>{nodeInfo.y_trans.toFixed(3)}</span>
          </div>
          <div className="info-item">
            <label>Z Position:</label>
            <span>{nodeInfo.z_trans.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Associated Image */}
      {imageUrl && (
        <div className="info-section">
          <h4>Associated Image</h4>
          <div className="image-container">
            <img
              src={imageUrl}
              alt="Node view"
              className="node-image"
              onClick={() => setShowImage(!showImage)}
            />
            {showImage && (
              <div className="image-modal" onClick={() => setShowImage(false)}>
                <img src={imageUrl} alt="Node view" className="modal-image" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create New Label Form */}
      {showCreateForm && (
        <div className="info-section">
          <h4>Add New Label</h4>
          <CreateLabelForm
            onSubmit={handleCreateOtherNode}
            onCancel={() => setShowCreateForm(false)}
            nodeTypes={nodeTypes}
          />
        </div>
      )}

      {/* Existing Labels */}
      <div className="info-section">
        <h4>Labels ({otherNodes.length})</h4>
        {otherNodes.length === 0 ? (
          <p className="no-labels">No labels for this node</p>
        ) : (
          <div className="labels-list">
            {otherNodes.map((otherNode) => (
              <div key={otherNode.id} className="label-item">
                <div className="label-header">
                  <span
                    className={`label-type ${
                      nodeTypes[otherNode.type as keyof typeof nodeTypes]?.color
                    }`}
                  >
                    {nodeTypes[otherNode.type as keyof typeof nodeTypes]?.icon}
                  </span>
                  <span className="label-text">{otherNode.label}</span>
                  <div className="label-actions">
                    <button
                      onClick={() => setEditingOtherNode(otherNode)}
                      className="edit-btn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteOtherNode(otherNode.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {otherNode.description && (
                  <p className="label-description">{otherNode.description}</p>
                )}
                {editingOtherNode?.id === otherNode.id && (
                  <EditLabelForm
                    otherNode={otherNode}
                    onSubmit={handleUpdateOtherNode}
                    onCancel={() => setEditingOtherNode(null)}
                    nodeTypes={nodeTypes}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .node-inspector {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .no-selection {
          text-align: center;
          color: #666;
          padding: 32px 16px;
        }

        .inspector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .inspector-header h3 {
          margin: 0;
          color: #333;
          font-size: 18px;
        }

        .label-indicator {
          font-size: 12px;
          color: #9c27b0;
          font-weight: 500;
        }

        .add-label-btn {
          padding: 6px 12px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .add-label-btn:hover {
          background: #218838;
        }

        .info-section {
          margin-bottom: 24px;
        }

        .info-section h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 16px;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-item label {
          font-weight: 500;
          color: #666;
          min-width: 80px;
          flex-shrink: 0;
        }

        .info-item span {
          text-align: right;
          color: #333;
          word-break: break-word;
        }

        .image-container {
          position: relative;
        }

        .node-image {
          width: 100%;
          max-height: 200px;
          object-fit: cover;
          border-radius: 4px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .node-image:hover {
          transform: scale(1.02);
        }

        .image-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .modal-image {
          max-width: 90vw;
          max-height: 90vh;
          object-fit: contain;
        }

        .labels-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .label-item {
          border: 1px solid #eee;
          border-radius: 6px;
          padding: 12px;
          background: #f8f9fa;
        }

        .label-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .label-type {
          font-size: 16px;
        }

        .label-text {
          flex: 1;
          font-weight: 500;
          color: #333;
        }

        .label-actions {
          display: flex;
          gap: 4px;
        }

        .edit-btn, .delete-btn {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }

        .edit-btn {
          background: #007bff;
          color: white;
        }

        .edit-btn:hover {
          background: #0056b3;
        }

        .delete-btn {
          background: #dc3545;
          color: white;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .label-description {
          margin: 0;
          color: #666;
          font-size: 14px;
          font-style: italic;
        }

        .no-labels {
          color: #666;
          font-style: italic;
          text-align: center;
          padding: 16px;
        }

        .loading, .error {
          text-align: center;
          padding: 32px 16px;
        }

        .error {
          color: #dc3545;
        }

        .retry-btn {
          margin-left: 8px;
          padding: 4px 8px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .retry-btn:hover {
          background: #c82333;
        }
      `}</style>
    </div>
  )
}

// Create Label Form Component
interface CreateLabelFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
  nodeTypes: any
}

const CreateLabelForm: React.FC<CreateLabelFormProps> = ({
  onSubmit,
  onCancel,
  nodeTypes,
}) => {
  const [formData, setFormData] = useState({
    label: '',
    description: '',
    type: 0,
    x_offset: 0,
    y_offset: 0.05,
    z_offset: 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="label-form">
      <div className="form-group">
        <label>Label:</label>
        <input
          type="text"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Description:</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={2}
        />
      </div>

      <div className="form-group">
        <label>Type:</label>
        <select
          value={formData.type}
          onChange={(e) =>
            setFormData({ ...formData, type: Number(e.target.value) })
          }
        >
          {Object.entries(nodeTypes).map(([key, type]: [string, any]) => (
            <option key={key} value={key}>
              {type.icon} {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn">
          Create
        </button>
        <button type="button" onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
      </div>

      <style>{`
        .label-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-group label {
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 60px;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .submit-btn {
          flex: 1;
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .submit-btn:hover {
          background: #218838;
        }

        .cancel-btn {
          padding: 8px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .cancel-btn:hover {
          background: #545b62;
        }
      `}</style>
    </form>
  )
}

// Edit Label Form Component
interface EditLabelFormProps {
  otherNode: OtherNode
  onSubmit: (data: OtherNode) => void
  onCancel: () => void
  nodeTypes: any
}

const EditLabelForm: React.FC<EditLabelFormProps> = ({
  otherNode,
  onSubmit,
  onCancel,
  nodeTypes,
}) => {
  const [formData, setFormData] = useState({
    ...otherNode,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="label-form">
      <div className="form-group">
        <label>Label:</label>
        <input
          type="text"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Description:</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={2}
        />
      </div>

      <div className="form-group">
        <label>Type:</label>
        <select
          value={formData.type}
          onChange={(e) =>
            setFormData({ ...formData, type: Number(e.target.value) })
          }
        >
          {Object.entries(nodeTypes).map(([key, type]: [string, any]) => (
            <option key={key} value={key}>
              {type.icon} {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn">
          Update
        </button>
        <button type="button" onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default NodeInspector
