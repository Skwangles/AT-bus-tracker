import React, { useState } from 'react'
import LocationGroupSelector from './LocationGroupSelector'
import FloorplanEditor from './FloorplanEditor'
import Legend from './Legend'

const App: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  const handleLocationSelect = (location: string) => {
    setSelectedLocation(location)
  }

  const handleLocationCreate = (name: string) => {
    setSelectedLocation(name)
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <LocationGroupSelector
          selectedLocation={selectedLocation}
          onLocationSelect={handleLocationSelect}
          onLocationCreate={handleLocationCreate}
        />
        {selectedLocation && <Legend />}
      </div>
      
      <div className="main-content">
        {selectedLocation ? (
          <FloorplanEditor floorplan={selectedLocation} />
        ) : (
          <div className="welcome-message">
            <h2>Welcome to SiteExplorer Authoring</h2>
            <p>Select a location group from the sidebar to start editing floorplans.</p>
            <div className="features">
              <div className="feature">
                <h3>🎯 Point Management</h3>
                <p>Drag to select multiple points, edit positions, and manage node types.</p>
              </div>
              <div className="feature">
                <h3>📷 Image Upload</h3>
                <p>Upload floorplan images with drag-and-drop support and preview.</p>
              </div>
              <div className="feature">
                <h3>🏷️ Label Management</h3>
                <p>Add and edit labels, descriptions, and other node information.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .app-container {
          display: flex;
          height: 100vh;
          background: #f5f5f5;
        }

        .sidebar {
          width: 400px;
          background: white;
          border-right: 1px solid #ddd;
          padding: 16px;
          overflow-y: auto;
        }

        .main-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .welcome-message {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
        }

        .welcome-message h2 {
          color: #333;
          margin-bottom: 16px;
          font-size: 28px;
        }

        .welcome-message p {
          color: #666;
          font-size: 16px;
          margin-bottom: 32px;
        }

        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          max-width: 800px;
          width: 100%;
        }

        .feature {
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: left;
        }

        .feature h3 {
          color: #333;
          margin-bottom: 12px;
          font-size: 18px;
        }

        .feature p {
          color: #666;
          font-size: 14px;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .app-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: 300px;
            border-right: none;
            border-bottom: 1px solid #ddd;
          }

          .features {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default App
