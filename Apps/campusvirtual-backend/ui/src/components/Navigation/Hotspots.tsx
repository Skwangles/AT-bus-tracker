import * as THREE from "three";
import { useRef, useState } from "react";
import {
  HOTSPOT_COLOUR,
  HOTSPOT_HIGHLIGHTED,
  HOTSPOT_HOVERED,
  HOTSPOT_OUTLINE,
  HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL,
  SPHERE_SIZE,
  USE_GLB_MARKER_OBJECT,
} from "../../consts";
import Model from "./Model";
import { useFrame } from "@react-three/fiber";
import { ThreeNumbersArray } from "../../types";

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
  const endMarkerSize = sphereSize * 3;
  const endMarkerOutlineSize = endMarkerSize * 1.09;
  const outlineSize = sphereSize * 1.09;

  position[1] -= HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL;

  const endRef = useRef<any>(null);
  const outlineEndRef = useRef<any>(null);

  // State to track hover
  const [isHovered, setIsHovered] = useState(false);

  useFrame((state, delta) => {
    if (
      isEnd &&
      endRef.current &&
      endRef.current.rotation &&
      outlineEndRef.current &&
      outlineEndRef.current.rotation
    ) {
      endRef.current.rotation.x += delta;
      outlineEndRef.current.rotation.x += delta;
    }
  });

  if (USE_GLB_MARKER_OBJECT && isEnd) {
    return <Model position={position} onClick={onClick} />;
  }

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
          <boxGeometry args={[endMarkerSize, endMarkerSize, endMarkerSize]} />
        ) : (
          <sphereGeometry args={[sphereSize, 20, 20]} />
        )}
        <meshStandardMaterial
          color={
            isHovered
              ? HOTSPOT_HOVERED
              : isEnd
              ? "#AAAAAA"
              : isHighlighted
              ? HOTSPOT_HIGHLIGHTED
              : HOTSPOT_COLOUR
          }
        />
      </mesh>
      <mesh
        position={position}
        rotation={rotation}
        ref={outlineEndRef}
        onClick={onClick}
        scale={isClickable ? 1 : 0}
      >
        {isEnd ? (
          <boxGeometry
            args={[
              endMarkerOutlineSize,
              endMarkerOutlineSize,
              endMarkerOutlineSize,
            ]}
          />
        ) : (
          <sphereGeometry args={[outlineSize, 20, 20]} />
        )}
        <meshBasicMaterial color={HOTSPOT_OUTLINE} side={THREE.BackSide} />
      </mesh>
    </>
  );
};

export default Hotspot;
