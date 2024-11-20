import { useRef, useEffect } from 'react';
import { MapPin, User } from 'lucide-react';
import { useTourStore } from '../store';

export const Minimap = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { currentNode, nodes, locations, setCurrentNode } = useTourStore();
  
  const currentLocation = locations.find(l => l.id === currentNode?.locationId);
  const locationNodes = nodes.filter(n => n.locationId === currentNode?.locationId);

  if (!currentLocation || !currentNode) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Find closest node
    const closest = locationNodes.reduce((prev, curr) => {
      const prevDist = Math.sqrt(
        Math.pow(prev.mapX - x, 2) + Math.pow(prev.mapY - y, 2)
      );
      const currDist = Math.sqrt(
        Math.pow(curr.mapX - x, 2) + Math.pow(curr.mapY - y, 2)
      );
      return currDist < prevDist ? curr : prev;
    });
    
    setCurrentNode(closest.id);
  };

  return (
    <div className="fixed top-4 right-4 w-64 bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-2 bg-gray-800 text-white text-sm font-medium">
        {currentLocation.name}
      </div>
      <div
        ref={canvasRef}
        className="relative w-full h-64 cursor-pointer"
        onClick={handleClick}
      >
        <img
          src={currentLocation.mapImage}
          alt={currentLocation.name}
          className="w-full h-full object-cover"
        />
        {locationNodes.map(node => (
          <div
            key={node.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              node.id === currentNode.id ? 'text-orange-500 z-10' : 'text-blue-500'
            }`}
            style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
          >
            {node.id === currentNode.id ? (
              <User className="w-6 h-6" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};