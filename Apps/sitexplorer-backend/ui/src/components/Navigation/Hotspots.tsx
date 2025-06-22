import * as THREE from "three";
import { useRef, useState } from "react";
import {
  HOTSPOT_COLOUR,
  HOTSPOT_HIGHLIGHTED,
  HOTSPOT_HOVERED,
  HOTSPOT_OUTLINE,
  SPHERE_SIZE
} from "../../consts";
import { useFrame } from "@react-three/fiber";
import { ThreeNumbersArray } from "../../types";
import { useGLTF } from "@react-three/drei";

// Utility function to detect mobile devices
const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface HotspotProps {
  position: ThreeNumbersArray;
  rotation: ThreeNumbersArray;
  image_identifier: string;
  onClick: () => void;
  isHighlighted: boolean;
  isEnd: boolean;
  isPathfinding: boolean;
}

const Hotspot: React.FC<HotspotProps> = ({
  position,
  onClick,
  rotation,
  isHighlighted,
  isPathfinding,
  isEnd,
}) => {
  const isClickable = !isPathfinding || isHighlighted;
  // Increase size for mobile
  const sizeMultiplier = isMobile() ? 1.5 : 1;
  const sphereSize = SPHERE_SIZE * sizeMultiplier;
  const endMarkerSize = sphereSize * 5;
  const outlineSize = sphereSize * 1.09;

  // position[1] -= HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL;

  const endRef = useRef<any>(null);
  const outlineEndRef = useRef<any>(null);

  // State to track hover
  const [isHovered, setIsHovered] = useState(false);

  // Load the marker GLB model for end of pathfinding
  const { scene: markerScene } = useGLTF('/marker.glb');

  useFrame((state, delta) => {
    if (isEnd && endRef.current && endRef.current.rotation) {
      endRef.current.rotation.y += delta;
    }
  });
  
  console.log("Hotspot rendered:", position, rotation);

  return (
    <>
      <mesh
        position={position}
        rotation={rotation}
        ref={endRef}
        onClick={isClickable ? onClick : () => {}}
        onPointerOver={() => isClickable && setIsHovered(true)}
        onPointerOut={() => isClickable && setIsHovered(false)}
        receiveShadow
        scale={isClickable ? 1 : 0} // visibility attribute still renders the object, so it can still be clicked - scale makes it unclickable, but still rendered
      >
        {isEnd ? (
          <primitive object={markerScene.clone()} scale={[endMarkerSize, endMarkerSize, endMarkerSize]} />
        ) : (
          <sphereGeometry args={[sphereSize, 20, 20]} />
        )}
        {!isEnd && (
          <meshStandardMaterial
            color={
              isHovered
                ? HOTSPOT_HOVERED
                : isHighlighted
                ? HOTSPOT_HIGHLIGHTED
                : HOTSPOT_COLOUR
            }
          />
        )}
      </mesh>
      {!isEnd && (
        <mesh
          position={position}
          rotation={rotation}
          ref={outlineEndRef}
          onClick={onClick}
          scale={isClickable ? 1 : 0}
        >
          <sphereGeometry args={[outlineSize, 20, 20]} />
          <meshBasicMaterial color={HOTSPOT_OUTLINE} side={THREE.BackSide} />
        </mesh>
      )}
    </>
  );
};

export default Hotspot;
