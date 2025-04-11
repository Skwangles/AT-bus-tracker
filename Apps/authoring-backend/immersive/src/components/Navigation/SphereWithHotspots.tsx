import * as THREE from "three";
import { useEffect, useState, useRef } from "react";
import { API_PREFIX, HIDE_POINTS_DURING_HIGHLIGHT } from "../../consts";
import Hotspot, { HotspotObj } from "./Hotspots";
import { Html } from "@react-three/drei";
import { toast } from "react-toastify";

interface SphereWithHotspotsProps {
  position: THREE.Vector3;
  textureUrl: string;
  hotspots: HotspotObj[];
  onHotspotClick: (hotspot: HotspotObj) => void;
  rotation: ThreeNumbersArray;
  highlightedOrbs: number[];
  isPathfindingMode: boolean;
}

// Define resolution levels
const RESOLUTION_LEVELS = [
  { name: "preview", delay: 0 }, // 64x32 instant preview
  { name: "lowest", delay: 100 }, // 256x128
  { name: "low", delay: 300 }, // 512x256
  { name: "medium", delay: 800 }, // 1024x512
  { name: "high", delay: 1500 }, // 2048x1024
  { name: "ultra", delay: 2500 }, // 4096x2048
];

const SphereWithHotspots: React.FC<SphereWithHotspotsProps> = ({
  position,
  textureUrl,
  hotspots,
  onHotspotClick,
  rotation,
  isPathfindingMode,
  highlightedOrbs,
}) => {
  const [currentTexture, setCurrentTexture] = useState<THREE.Texture>(
    new THREE.Texture()
  );
  const [previousTexture, setPreviousTexture] = useState<THREE.Texture | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const currentTextureUrlRef = useRef(textureUrl);
  const loadingQueue = useRef<NodeJS.Timeout[]>([]);

  const loadTextureAtResolution = async (resolution: string) => {
    if (currentTextureUrlRef.current !== textureUrl) return null;

    try {
      const texture = await new THREE.TextureLoader().loadAsync(
        `${API_PREFIX}/api/v1/image/${resolution}/${textureUrl}`
      );

      // Only update if we're still on the same image
      if (currentTextureUrlRef.current === textureUrl) {
        return texture;
      }
    } catch (err) {
      toast.error("Could not load point image");
    }
    return null;
  };

  useEffect(() => {
    setIsLoading(true);
    // Store previous texture for transition
    if (currentTexture.image) {
      setPreviousTexture(currentTexture);
      setTransitionProgress(0);
    }

    // Clear any pending loads
    loadingQueue.current.forEach((timeout) => clearTimeout(timeout));
    loadingQueue.current = [];

    // Update reference
    currentTextureUrlRef.current = textureUrl;

    // Queue up loading of each resolution level
    RESOLUTION_LEVELS.forEach(({ name, delay }) => {
      const timeout = setTimeout(async () => {
        const newTexture = await loadTextureAtResolution(name);
        if (newTexture) {
          setCurrentTexture(newTexture);
          setTransitionProgress(1);
          if (delay === 0) setIsLoading(false);
        }
      }, delay);
      loadingQueue.current.push(timeout);
    });

    return () => {
      loadingQueue.current.forEach((timeout) => clearTimeout(timeout));
      currentTextureUrlRef.current = "";
    };
  }, [textureUrl]);

  rotation[1] += Math.PI / 2;

  return (
    <group>
      {/* Previous sphere for smooth transition */}
      {previousTexture && (
        <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}>
          <sphereGeometry args={[1000, 64, 64]} />
          <meshBasicMaterial
            map={previousTexture}
            side={THREE.BackSide}
            transparent
            opacity={1 - transitionProgress}
          />
        </mesh>
      )}

      {/* Current sphere */}
      <mesh rotation={rotation} position={position} scale={[-1, 1, 1]}>
        <sphereGeometry args={[1000, 64, 64]} />
        <meshBasicMaterial
          map={currentTexture}
          side={THREE.BackSide}
          transparent
          opacity={transitionProgress}
        />
      </mesh>

      {/* Loading indicator */}
      {isLoading && (
        <Html center position={[0, 0, 0]}>
          <div className="loading-spinner">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </Html>
      )}

      {/* Hotspots */}
      {hotspots
        .filter((hotspot) =>
          HIDE_POINTS_DURING_HIGHLIGHT && isPathfindingMode
            ? highlightedOrbs.includes(Number(hotspot.id))
            : true
        )
        .map((hotspot, index) => (
          <Hotspot
            key={index}
            position={hotspot.position}
            rotation={hotspot.rotation}
            image_identifier={Number(hotspot.ts).toFixed(5)}
            onClick={() => onHotspotClick(hotspot)}
            isPathfinding={isPathfindingMode}
            isHighlighted={highlightedOrbs.includes(Number(hotspot.id))}
            isEnd={
              isPathfindingMode
                ? highlightedOrbs[highlightedOrbs.length - 1] ===
                  Number(hotspot.id)
                : false
            }
          />
        ))}
    </group>
  );
};

export default SphereWithHotspots;
