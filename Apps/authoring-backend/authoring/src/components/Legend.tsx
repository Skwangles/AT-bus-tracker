import React from 'react'

const Legend: React.FC = () => {
  return (
    <div className="legend">
      <h4>Node Types</h4>
      <div className="legend-items">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#00ff00' }}></div>
          <span>Normal Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ff6b35' }}></div>
          <span>Border Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#9c27b0' }}></div>
          <span>Nodes with Labels</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#28a745' }}></div>
          <span>Elevator Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ffc107' }}></div>
          <span>Toilet Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#17a2b8' }}></div>
          <span>Info Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#6f42c1' }}></div>
          <span>Stair Nodes</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#dc3545' }}></div>
          <span>Exit Nodes</span>
        </div>
      </div>

      <style>{`
        .legend {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .legend h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 16px;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid #ccc;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}

export default Legend 