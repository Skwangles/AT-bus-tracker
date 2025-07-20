import React, { useState, useRef, useCallback } from 'react'
import { API_PREFIX } from '../consts'
import axios from 'axios'

interface FileUploadProps {
  currentFloor: string
  isImageSelected: boolean
  onUploadSuccess?: () => void
}

interface UploadStatus {
  type: 'idle' | 'uploading' | 'success' | 'error'
  message: string
}

const FileUpload: React.FC<FileUploadProps> = ({
  currentFloor,
  isImageSelected,
  onUploadSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ type: 'idle', message: '' })
  const [isDragOver, setIsDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      createImagePreview(file)
      setUploadStatus({ type: 'idle', message: '' })
  }
  }

  const createImagePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus({ type: 'error', message: 'Please select a file first.' })
      return
    }

    setUploadStatus({ type: 'uploading', message: 'Uploading image...' })

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      await axios.post(
        `${API_PREFIX}/api/v1/authoring/maps/${currentFloor}/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      setUploadStatus({ type: 'success', message: 'Image uploaded successfully!' })
      setSelectedFile(null)
      setImagePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (onUploadSuccess) {
        onUploadSuccess()
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setUploadStatus({ type: 'error', message: 'Error uploading image. Please try again.' })
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      setSelectedFile(imageFile)
      createImagePreview(imageFile)
      setUploadStatus({ type: 'idle', message: '' })
    } else {
      setUploadStatus({ type: 'error', message: 'Please drop an image file.' })
    }
  }, [])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const getStatusColor = () => {
    switch (uploadStatus.type) {
      case 'success': return '#28a745'
      case 'error': return '#dc3545'
      case 'uploading': return '#007bff'
      default: return '#6c757d'
    }
  }

  return (
    <div className="file-upload-container">
      <div className="upload-header">
        <h4>Floorplan Image</h4>
        <div className="status-indicator">
          <span className={`status-dot ${isImageSelected ? 'has-image' : 'no-image'}`}>
            {isImageSelected ? '📷' : '❌'}
          </span>
          <span className="status-text">
            {isImageSelected ? 'Image uploaded' : 'No image'}
          </span>
        </div>
      </div>

      <div
        className={`upload-area ${isDragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        {imagePreview ? (
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" />
            <div className="preview-overlay">
              <span>Click to change image</span>
            </div>
          </div>
        ) : (
          <div className="upload-placeholder">
            <div className="upload-icon">📁</div>
            <p>Drop image here or click to select</p>
            <p className="upload-hint">Supports: JPG, PNG, GIF</p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="file-info">
          <span className="file-name">{selectedFile.name}</span>
          <span className="file-size">
            ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </span>
        </div>
      )}

      {uploadStatus.message && (
        <div className="upload-status" style={{ color: getStatusColor() }}>
          {uploadStatus.type === 'uploading' && <span className="spinner">⏳</span>}
          {uploadStatus.message}
        </div>
      )}

      <div className="upload-actions">
        <button
          onClick={handleFileUpload}
          disabled={!selectedFile || uploadStatus.type === 'uploading'}
          className="upload-btn"
        >
          {uploadStatus.type === 'uploading' ? 'Uploading...' : 
           isImageSelected ? 'Replace Image' : 'Upload Image'}
        </button>
        
        {selectedFile && (
          <button
            onClick={() => {
              setSelectedFile(null)
              setImagePreview(null)
              setUploadStatus({ type: 'idle', message: '' })
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
            className="cancel-btn"
          >
            Cancel
      </button>
        )}
      </div>

      <style>{`
        .file-upload-container {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          max-width: 400px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .upload-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .upload-header h4 {
          margin: 0;
          color: #333;
          font-size: 16px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
        }

        .status-dot {
          font-size: 16px;
        }

        .status-dot.has-image {
          color: #28a745;
        }

        .status-dot.no-image {
          color: #dc3545;
        }

        .upload-area {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 32px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #f8f9fa;
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-area:hover {
          border-color: #007bff;
          background: #f0f8ff;
        }

        .upload-area.drag-over {
          border-color: #007bff;
          background: #e3f2fd;
          transform: scale(1.02);
        }

        .upload-area.has-file {
          border-color: #28a745;
          background: #f8fff8;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .upload-icon {
          font-size: 32px;
          color: #666;
        }

        .upload-placeholder p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .upload-hint {
          font-size: 12px !important;
          color: #999 !important;
        }

        .image-preview {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-preview img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .preview-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
          border-radius: 4px;
        }

        .image-preview:hover .preview-overlay {
          opacity: 1;
        }

        .file-info {
          margin: 12px 0;
          padding: 8px 12px;
          background: #f8f9fa;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        .file-name {
          font-weight: 500;
          color: #333;
        }

        .file-size {
          color: #666;
        }

        .upload-status {
          margin: 8px 0;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .upload-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .upload-btn {
          flex: 1;
          padding: 10px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .upload-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .upload-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .cancel-btn {
          padding: 10px 16px;
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
    </div>
  )
}

export default FileUpload
