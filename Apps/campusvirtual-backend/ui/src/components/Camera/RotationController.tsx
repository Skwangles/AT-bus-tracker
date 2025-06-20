import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Euler } from "three";
import { HotspotObj, MoveDirectionType, RotationData } from "../../types";
import * as THREE from "three";
import { moveDirection } from "../../utils/moveDirection";
import { toast } from "react-toastify";

interface CameraRotationControlsProps {
  hotspots: HotspotObj[];
  setCurrentId: (id: string) => void;
  camRotation: React.MutableRefObject<RotationData>;
}

const CameraRotationControls = forwardRef<
  { handleMove: (direction: MoveDirectionType) => void; handleRotate: (direction: 'left' | 'right') => void; stopRotate: () => void },
  CameraRotationControlsProps
>(({ hotspots, setCurrentId, camRotation }, ref) => {
  const { camera, gl } = useThree();
  const hotspotsRef = useRef(hotspots);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);

  useEffect(() => {
    hotspotsRef.current = hotspots;
  }, [hotspots]);

  const controlsRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    rotationSpeed: 0.03,
    mouseRotationSpeed: 0.002,
    initialPitch: camRotation.current["pitch"],
    initialYaw: camRotation.current["yaw"],
    euler: new Euler(
      camRotation.current["pitch"] ?? 0,
      camRotation.current["yaw"] ?? 0,
      0,
      "YXZ"
    ),
    // Movement control properties
    speed: 0.015,
    isMoving: false,
    direction: 0
  });

  const keyDown = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>();

  const protectFromFlippingPitch = (nextX) => {
    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, nextX));
  };

  useImperativeHandle(ref, () => ({
    handleMove: (direction: MoveDirectionType) => {
      actionMoveDirection(direction, camera, hotspotsRef.current);
    },
    handleRotate: (direction: 'left' | 'right') => {
      const controls = controlsRef.current;
      controls.isMoving = true;
      controls.direction = direction === 'left' ? -1 : 1;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateMovement);
      }
    },
    stopRotate: () => {
      const controls = controlsRef.current;
      controls.isMoving = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    }
  }));

  useEffect(() => {
    camera.rotation.copy(controlsRef.current.euler);
  }, [camera]);

  const actionMoveDirection = (
    direction: MoveDirectionType,
    camera: THREE.Camera,
    hotspots: HotspotObj[]
  ) => {
    const id = moveDirection(direction, camera, hotspots);
    if (id) {
      setCurrentId(id);
    } else {
      toast.warn("No point found in the given direction");
    }
  };

  const updateMovement = () => {
    const controls = controlsRef.current;
    
    if (controls.isMoving) {
      if (controls.direction === 1) {
        camera.rotation.y -= controls.speed;
        controls.euler.y = camera.rotation.y;
      } else if (controls.direction === -1) {
        camera.rotation.y += controls.speed;
        controls.euler.y = camera.rotation.y;
      }
      
      camRotation.current = {
        yaw: camera.rotation.y,
        pitch: camera.rotation.x,
      };

      animationFrameRef.current = requestAnimationFrame(updateMovement);
    }
  };

  const handleKeyDown = (event) => {
    // Only handle keyboard events if canvas is focused
    if (!isCanvasFocused) return;

    const validKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "w",
      "s",
      "a",
      "d",
    ];
    if (!validKeys.includes(event.key)) return;

    // Add key to set of pressed keys
    keyDown.current.add(event.key);

    // Handle WASD movement first
    if (event.key === "w") {
      actionMoveDirection(
        MoveDirectionType.Forward,
        camera,
        hotspotsRef.current
      );
      return;
    } else if (event.key === "s") {
      actionMoveDirection(
        MoveDirectionType.Backward,
        camera,
        hotspotsRef.current
      );
      return;
    } else if (event.key === "a") {
      actionMoveDirection(MoveDirectionType.Left, camera, hotspotsRef.current);
      return;
    } else if (event.key === "d") {
      actionMoveDirection(MoveDirectionType.Right, camera, hotspotsRef.current);
      return;
    }

    // Handle arrow keys
    if (event.key === "ArrowLeft") {
      controlsRef.current.isMoving = true;
      controlsRef.current.direction = -1;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateMovement);
      }
    } else if (event.key === "ArrowRight") {
      controlsRef.current.isMoving = true;
      controlsRef.current.direction = 1;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateMovement);
      }
    } else if (event.key === "ArrowUp") {
      camera.rotation.x = protectFromFlippingPitch(
        camera.rotation.x + controlsRef.current.rotationSpeed
      );
      controlsRef.current.euler.x = camera.rotation.x;
      camRotation.current = {
        yaw: camera.rotation.y,
        pitch: camera.rotation.x,
      };
    } else if (event.key === "ArrowDown") {
      camera.rotation.x = protectFromFlippingPitch(
        camera.rotation.x - controlsRef.current.rotationSpeed
      );
      controlsRef.current.euler.x = camera.rotation.x;
      camRotation.current = {
        yaw: camera.rotation.y,
        pitch: camera.rotation.x,
      };
    }
  };

  const handleKeyUp = (event) => {
    // Only handle keyboard events if canvas is focused
    if (!isCanvasFocused) return;

    // Remove key from set of pressed keys
    keyDown.current.delete(event.key);

    // Check if we should stop horizontal movement
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Only stop if neither left nor right arrow is pressed
      if (!keyDown.current.has("ArrowLeft") && !keyDown.current.has("ArrowRight")) {
        controlsRef.current.isMoving = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }
      } else {
        // Update direction based on remaining pressed key
        if (keyDown.current.has("ArrowLeft")) {
          controlsRef.current.direction = -1;
        } else if (keyDown.current.has("ArrowRight")) {
          controlsRef.current.direction = 1;
        }
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCanvasFocused]); // Add isCanvasFocused to dependencies

  useEffect(() => {
    const handleMouseDown = (event) => {
      controlsRef.current.isMouseDown = true;
      controlsRef.current.startX = event.clientX;
      controlsRef.current.startY = event.clientY;
      // Sync Euler angles with current camera rotation
      controlsRef.current.euler.copy(camera.rotation);
      // Set canvas as focused when mouse is clicked on it
      setIsCanvasFocused(true);
    };

    const handleMouseUp = () => {
      controlsRef.current.isMouseDown = false;
    };

    const handleMouseLeave = () => {
      controlsRef.current.isMouseDown = false;
    };

    const handleTouchStart = (event) => {
      controlsRef.current.isMouseDown = true;
      controlsRef.current.startX = event.touches[0].clientX;
      controlsRef.current.startY = event.touches[0].clientY;
      // Sync Euler angles with current camera rotation
      controlsRef.current.euler.copy(camera.rotation);
      // Set canvas as focused when touch starts on it
      setIsCanvasFocused(true);
    };

    const handleMouseMove = (event) => {
      if (!controlsRef.current.isMouseDown) return;

      const currentX = event.clientX;
      const currentY = event.clientY;
      const deltaX = currentX - controlsRef.current.startX;
      const deltaY = currentY - controlsRef.current.startY;

      controlsRef.current.startX = currentX;
      controlsRef.current.startY = currentY;

      // Update Euler rotation with mouse sensitivity
      controlsRef.current.euler.y += deltaX * controlsRef.current.mouseRotationSpeed;
      controlsRef.current.euler.x += deltaY * controlsRef.current.mouseRotationSpeed;

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = protectFromFlippingPitch(
        controlsRef.current.euler.x
      );

      camera.rotation.copy(controlsRef.current.euler);
      camRotation.current = {
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      };
    };

    const handleTouchMove = (event) => {
      if (!controlsRef.current.isMouseDown || event.touches.length !== 1) return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const deltaX = currentX - controlsRef.current.startX;
      const deltaY = currentY - controlsRef.current.startY;

      controlsRef.current.startX = currentX;
      controlsRef.current.startY = currentY;

      // Update Euler rotation with mouse sensitivity
      controlsRef.current.euler.y += deltaX * controlsRef.current.mouseRotationSpeed;
      controlsRef.current.euler.x += deltaY * controlsRef.current.mouseRotationSpeed;

      // Limit pitch to avoid flipping
      controlsRef.current.euler.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, controlsRef.current.euler.x)
      );

      camera.rotation.copy(controlsRef.current.euler);
      camRotation.current = {
        yaw: controlsRef.current.euler.y,
        pitch: controlsRef.current.euler.x,
      };
    };

    const handleTouchEnd = () => {
      controlsRef.current.isMouseDown = false;
    };

    // Add click outside handler to unfocus canvas
    const handleClickOutside = (event) => {
      if (!gl.domElement.contains(event.target)) {
        setIsCanvasFocused(false);
      }
    };

    // Mouse controls
    gl.domElement.addEventListener("mousedown", handleMouseDown);
    gl.domElement.addEventListener("mousemove", handleMouseMove);
    gl.domElement.addEventListener("mouseup", handleMouseUp);
    gl.domElement.addEventListener("mouseleave", handleMouseLeave);

    // Touch controls
    gl.domElement.addEventListener("touchstart", handleTouchStart);
    gl.domElement.addEventListener("touchmove", handleTouchMove);
    gl.domElement.addEventListener("touchend", handleTouchEnd);
    gl.domElement.addEventListener("touchcancel", handleTouchEnd);

    // Add click outside listener
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
      gl.domElement.removeEventListener("mouseup", handleMouseUp);
      gl.domElement.removeEventListener("mouseleave", handleMouseLeave);

      gl.domElement.removeEventListener("touchstart", handleTouchStart);
      gl.domElement.removeEventListener("touchmove", handleTouchMove);
      gl.domElement.removeEventListener("touchend", handleTouchEnd);
      gl.domElement.removeEventListener("touchcancel", handleTouchEnd);

      // Remove click outside listener
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [camera, gl.domElement]);

  return null;
});

export default CameraRotationControls;
