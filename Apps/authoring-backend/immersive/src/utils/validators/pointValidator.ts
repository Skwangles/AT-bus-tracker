import { NeighbourData, PointData } from "../../types";

/**
 * Check if a point has the valid properties at runtime
 * @param point
 * @returns
 */
export function checkPoint(
  point: PointData | NeighbourData,
  hasLocationTag = true
): boolean {
  if (!point) {
    console.warn("Point is null or undefined");
    return false;
  }

  // Check pose
  if (!point.pose || !Array.isArray(point.pose) || point.pose.length !== 16) {
    console.warn("Point does not have valid pose");
    return false;
  }
  if (point.pose.some((value) => typeof value !== "number")) {
    console.warn("Point does not have valid pose");
    return false;
  }

  // Check number/string properties
  if (!point.ts || isNaN(Number(point.ts))) {
    console.warn("Point does not have valid ts");
    return false;
  }

  if (isNaN(Number(point.keyframe_id)) || Number(point.keyframe_id) < 0) {
    console.warn("Point does not have valid keyframe_id");
    return false;
  }

  if (
    hasLocationTag &&
    "location" in point &&
    (!point.location || typeof point.location !== "string")
  ) {
    console.warn("Point does not have valid location tag");
    return false;
  }

  if (hasLocationTag && !("location" in point)) {
    console.warn("Point does not have valid location tag");
    return false;
  }

  // Check positional properties
  if (
    isNaN(Number(point.x_trans)) ||
    isNaN(Number(point.y_trans)) ||
    isNaN(Number(point.z_trans))
  ) {
    console.warn("Point does not have valid positional properties");
    return false;
  }

  return true;
}
