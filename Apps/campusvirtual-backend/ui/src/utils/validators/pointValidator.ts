import { PointData } from "../../types";

/**
 * Check if a point has the valid properties at runtime
 * @param point
 * @returns
 */
export function checkPoint(point: PointData): boolean {
  if (!point) {
    return false;
  }

  // Check pose
  if (!point.pose || !Array.isArray(point.pose) || point.pose.length !== 9) {
    return false;
  }
  if (point.pose.some((value) => typeof value !== "number")) {
    return false;
  }

  // Check number/string properties
  if (isNaN(Number(point.ts))) {
    return false;
  }

  if (isNaN(Number(point.keyframe_id)) && Number(point.keyframe_id) >= 0) {
    return false;
  }

  if (typeof point.location !== "string") {
    return false;
  }

  // Check positional properties
  if (
    isNaN(Number(point.x_trans)) ||
    isNaN(Number(point.y_trans)) ||
    isNaN(Number(point.z_trans))
  ) {
    return false;
  }

  return true;
}
