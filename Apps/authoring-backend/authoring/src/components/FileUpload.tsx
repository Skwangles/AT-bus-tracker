import { useState } from 'react'
import { API_PREFIX } from '../consts'
import axios from 'axios'

const FileUpload = ({
  currentFloor,
  isImageSelected,
}: {
  currentFloor: string
  isImageSelected: boolean
}) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadStatus, setUploadStatus] = useState('')

  // Handle file selection
  const handleFileChange = (event: any) => {
    setSelectedFile(event.target.files[0])
  }

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      await axios.post(
        `${API_PREFIX}/api/v1/maps/${currentFloor}/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      setUploadStatus('File uploaded successfully.')
    } catch (error) {
      console.error('Error uploading file:', error)
      setUploadStatus('Error uploading file.')
    }
  }

  return (
    <div style={{ margin: '5px' }}>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleFileUpload}>
        {isImageSelected ? 'Change Image' : 'Upload Image'}
      </button>
      <p>{uploadStatus}</p>
    </div>
  )
}

export default FileUpload
