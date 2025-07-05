import * as THREE from "three";
import { useEffect, useState, useRef } from "react";
import { API_PREFIX, HIDE_POINTS_DURING_HIGHLIGHT, HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL } from "../../consts";
import { HotspotObj, ThreeNumbersArray } from "../../types";
import { toast } from "react-toastify";
import { getPointAsImageNumber } from "../../utils/utils";
import { useThree } from "@react-three/fiber";
import Hotspots from "./Hotspots";
import Panosphere from "./Panosphere";

interface SphereWithHotspotsProps {
  position: React.MutableRefObject<THREE.Vector3>;
  textureUrl: string;
  hotspots: HotspotObj[];
  onHotspotClick: (hotspot: HotspotObj) => void;
  imageRotation: React.MutableRefObject<ThreeNumbersArray>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
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

const Scene: React.FC<SphereWithHotspotsProps> = ({
  position,
  textureUrl,
  hotspots,
  onHotspotClick,
  imageRotation,
  isPathfindingMode,
  setIsLoading,
  highlightedOrbs,
}) => {

  const [hotspotComponents, setHotspotComponents] = useState<React.ReactNode[]>([]);
  const [currentTexture, setCurrentTexture] = useState<THREE.Texture>(
    new THREE.Texture()
  );
  const { camera } = useThree();
  const [previousTexture, setPreviousTexture] = useState<THREE.Texture | null>(
    null
  );

  const showPrevious = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const previousImgMeshRef = useRef<THREE.MeshBasicMaterial>(null);
  const currentImgMeshRef = useRef<THREE.MeshBasicMaterial>(null);

  const currentTextureUrlRef = useRef(textureUrl);
  const loadingQueue = useRef<NodeJS.Timeout[]>([]);

  const calculateShownHotspots = (
    hotspots: HotspotObj[],
    isPathfindingMode: boolean,
    highlightedOrbs: number[]
  ) => {
    console.log("Calculating shown hotspots");
    return hotspots
      .map((hotspot) => ({
        ...hotspot,
        isHighlighted: highlightedOrbs.includes(Number(hotspot.id)),
        isEnd: isPathfindingMode
          ? highlightedOrbs[highlightedOrbs.length - 1] === Number(hotspot.id)
          : false,
      }))
      .filter((hotspot) =>
        HIDE_POINTS_DURING_HIGHLIGHT && isPathfindingMode
          ? highlightedOrbs.includes(Number(hotspot.id))
          : true
      );
  };

  const [shownHotspots, setShownHotspots] = useState<
    (HotspotObj & { isHighlighted: boolean; isEnd: boolean })[]
  >(calculateShownHotspots(hotspots, isPathfindingMode, highlightedOrbs));
  const previousImageRotation = useRef<ThreeNumbersArray>(
    imageRotation.current
  );
  const loadedImageRotation = useRef<ThreeNumbersArray>(imageRotation.current);
  const loadedPosition = useRef<THREE.Vector3>(position.current);

  const loadTextureAtResolution = async (resolution: string, textureUrl) => {
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
    console.log("**********Transition start***********");
    setIsTransitioning(true);
    if (currentTexture.image) {
      setPreviousTexture(currentTexture);
      previousImageRotation.current = loadedImageRotation.current;
      showPrevious.current = true;
    }

    // Clear any pending loads
    loadingQueue.current.forEach((timeout) => clearTimeout(timeout));
    loadingQueue.current = [];

    // Update the URL
    currentTextureUrlRef.current = textureUrl;

    // Queue up loading of each resolution level
    RESOLUTION_LEVELS.forEach(({ name, delay }) => {
      const timeout = setTimeout(async () => {
        const newTexture = await loadTextureAtResolution(name, textureUrl);
        if (newTexture) {
          console.log("Setting current texture to: ", name, " - ", newTexture);
          setCurrentTexture(newTexture);
          setIsTransitioning(false);
          showPrevious.current = false;

          if (delay === 0) {
            console.log("*******Transition end (First image has loaded)*******");
          }
        }
      }, delay);
      loadingQueue.current.push(timeout);
    });

    return () => {
      loadingQueue.current.forEach((timeout) => clearTimeout(timeout));
      currentTextureUrlRef.current = "";
    };
  }, [textureUrl]);

  useEffect(() => {
    if (isTransitioning) return;

    loadedImageRotation.current = imageRotation.current;
    loadedPosition.current = position.current;

    console.log("Setting cameras - Point: ", position.current, " from : ", camera.position);
    camera.position.set(
      position.current.x,
      position.current.y,
      position.current.z
    );
  }, [isTransitioning]);

  useEffect(() => {
    if (!isTransitioning) {
      const newShownHotspots = calculateShownHotspots(
        hotspots,
        isPathfindingMode,
        highlightedOrbs
      );
      console.log("New shown hotspots: ", newShownHotspots.length);
      setShownHotspots(newShownHotspots);
      const components = newShownHotspots.map((hotspot, index) => {
        console.log("Rendering individual hotspot");
        return (
        <Hotspots
          key={index}
          position={[hotspot.position[0], hotspot.position[1] - HOTSPOT_Y_ADJUSTMENT_DOWN_TO_FLOOR_LEVEL, hotspot.position[2]]}
          rotation={hotspot.rotation}
          image_identifier={getPointAsImageNumber(hotspot)}
          onClick={() => onHotspotClick(hotspot)}
          isPathfinding={isPathfindingMode}
          isHighlighted={hotspot.isHighlighted}
          isEnd={hotspot.isEnd}
        />
      )})
      setHotspotComponents(components);
    }
  }, [isTransitioning, isPathfindingMode, highlightedOrbs]);

  
  console.log(
    "Rendering scene - Number of hotspots: ",
    shownHotspots.length,
    "isTransitioning: ",
    isTransitioning,
    "Hotspots: ",
    shownHotspots
  );

  return (
    <group>
      <Panosphere
        showPrevious={showPrevious}
        loadedImageRotation={loadedImageRotation}
        loadedPosition={loadedPosition}
        currentImgMeshRef={currentImgMeshRef}
        currentTexture={currentTexture}
        previousTexture={previousTexture}
        previousImageRotation={previousImageRotation}
        previousImgMeshRef={previousImgMeshRef}
      />

      {hotspotComponents}
    </group>
  );
};

export default Scene;
