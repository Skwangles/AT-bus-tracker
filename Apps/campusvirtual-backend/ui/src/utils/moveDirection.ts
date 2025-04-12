import { MOVE_FOV_CHECK, MOVE_SPEED } from "../consts";
import { HotspotObj, MoveDirectionType } from "../types";
import * as THREE from "three";

/**
 * Check if a points' position is in the direction of the direction vector, i.e. not behind, or to the side of the camera
 * It should be within a certain angle of the camera direction, and within a certain distance
 * @param cameraPosition
 * @param direction
 * @param hotspot
 * @param maxDistance
 * @param minDistance
 * @returns true, if the hotspot is in front of the camera within FOV, false otherwise
 */
function checkWithinFOV(
  cameraPosition: THREE.Vector3,
  direction: THREE.Vector3,
  hotspot: THREE.Vector3,
  fov: number = MOVE_FOV_CHECK,
  maxDistance: number = MOVE_SPEED * 2,
  minDistance: number = MOVE_SPEED / 2,
  maxYDistance: number = MOVE_SPEED * 2
) {
  if (!cameraPosition || !direction || !hotspot) {
    throw new Error("cameraPosition, direction and hotspot must be defined");
  }
  if (cameraPosition.equals(hotspot)) {
    // if the hotspot is at the camera position, it is not in front of the camera
    return false;
  }
  if (Math.abs(cameraPosition.y - hotspot.y) > maxYDistance) {
    // if the hotspot is too high above or below the camera, it is not in front of the camera
    return false;
  }

  // Check if the hotspot is in front of the camera

  // flatten to 2D
  hotspot.y = cameraPosition.y;
  const angleFromDirectionTohotspot = Math.acos(
    direction.dot(hotspot.clone().sub(cameraPosition).normalize())
  );
  if (angleFromDirectionTohotspot > fov) {
    return false;
  }

  const distance = cameraPosition.distanceTo(hotspot);
  if (distance > maxDistance || distance < minDistance) {
    return false;
  }

  // Hotspot is in the direction of the camera
  return true;
}

/**
 * Given a set of points in 3D space, and the camera's current position and rotation,
 * this function will return the ID of the next point in the given direction.
 * i.e. find the point in the given direction that is closest to the camera.
 * @param direction
 * @param camera
 * @param hotspots
 * @returns point ID of next point in the given direction
 */
export function moveDirection(
  direction: MoveDirectionType,
  camera: THREE.Camera,
  hotspots: HotspotObj[]
) {
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  const cameraPosition = camera.position.clone();
  const moveDirection = new THREE.Vector3();

  switch (direction) {
    case MoveDirectionType.Forward:
      moveDirection.copy(cameraDirection);
      break;
    case MoveDirectionType.Backward:
      moveDirection.copy(cameraDirection).negate();
      break;
    case MoveDirectionType.Left:
      moveDirection.crossVectors(camera.up, cameraDirection);
      break;
    case MoveDirectionType.Right:
      moveDirection.crossVectors(cameraDirection, camera.up);
      break;
  }

  let closestPointId: string | null = null;
  let closestDistance = Infinity;

  hotspots.forEach((hotspot) => {
    const hotspotPosition = new THREE.Vector3(...hotspot.position);
    const isWithinFOV = checkWithinFOV(
      cameraPosition,
      cameraDirection,
      hotspotPosition,
      MOVE_FOV_CHECK
    );
    const distance = cameraPosition.distanceTo(hotspotPosition);
    if (isWithinFOV && distance < closestDistance) {
      closestDistance = distance;
      closestPointId = hotspot.id;
    }
  });
  if (closestPointId === null) {
    console.error("No closest point found");
    return null;
  }

  return closestPointId;
}
