import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lerp } from "three/src/math/MathUtils.js";

const Panosphere = ({
  loadedImageRotation,
  loadedPosition,
  currentImgMeshRef,
  currentTexture,
  previousTexture,
  previousImageRotation,
  previousImgMeshRef,
  showPrevious,
}) => {
    console.log("Rendering Panosphere - i.e. probably transitioning");

    useFrame(() => {
        if (
          previousImgMeshRef.current &&
          currentImgMeshRef.current &&
          !showPrevious.current
        ) {
          previousImgMeshRef.current.opacity = lerp(
            previousImgMeshRef.current.opacity,
            0,
            0.25
          );
          // currentImgMeshRef.current.opacity = 1;
        } else if (
          previousImgMeshRef.current &&
          currentImgMeshRef.current &&
          showPrevious.current
        ) {
          previousImgMeshRef.current.opacity = 1;
        }
      });

      
  return (<>
  {previousTexture && (
        <mesh
          rotation={previousImageRotation.current}
          position={loadedPosition.current}
          scale={[-1, 1, 1]}
        >
          <sphereGeometry args={[995, 64, 64]} />
          <meshBasicMaterial
            ref={previousImgMeshRef}
            map={previousTexture}
            side={THREE.BackSide}
            transparent
          />
        </mesh>
      )}
  
  
  
   <mesh
   rotation={loadedImageRotation.current}
   position={loadedPosition.current}
   scale={[-1, 1, 1]}
 >
   <sphereGeometry args={[1000, 64, 64]} />
   <meshBasicMaterial
     ref={currentImgMeshRef}
     map={currentTexture}
     side={THREE.BackSide}
     transparent
   />
 </mesh>
 </>)
};

export default Panosphere;