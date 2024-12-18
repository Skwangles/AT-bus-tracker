import sharp from "sharp";
import { COORDS_TO_METRES, KEYFRAME_IMG_EXTENSION, OUTDOORS_LOCATION_NAME, OUTDOORS_TARGET_CLOSENESS, OUTDOORS_Y_DIST_THRESHOLD, QUERY_PREFIX, TARGET_CLOSENESS, Y_DIST_THRESHOLD } from "./consts";
import * as THREE from "three";
import { readDB, writeDB } from "./db";
import { read } from "fs";

// Helper function to get node position
export async function getNodePosition(keyframeId: string, use_trans = true): Promise<[number, number, number] | null> {
  const nodeInfo = await getNodeInfo(keyframeId, use_trans);
  return nodeInfo["position"];
}

export async function getNodeInfo(keyframeId: string, use_trans = true) {

  const result = await readDB(
    `SELECT ts, label, pose, x_trans, y_trans, z_trans FROM ${QUERY_PREFIX}nodes WHERE keyframe_id = ? LIMIT 1;`,
    [keyframeId]
  );
  const positionInfo = result;
  if (!positionInfo || positionInfo.length == 0) {
    throw new Error("Could not find keyframe of ID: " + keyframeId);
  }

  const node_info = positionInfo[0];
  if (use_trans) {
    const ret: [number, number, number] = [
      -node_info.x_trans * COORDS_TO_METRES,
      -node_info.y_trans * COORDS_TO_METRES,
      node_info.z_trans * COORDS_TO_METRES,
    ];
    if (!ret) {
      console.error("Return result was Null of getNodePosition - using pose");
      return null;
    }
    node_info["position"] = ret;
    return node_info;
  }

  const ret = calculatePositionFromMatrix(result[0]?.pose);
  if (!ret) {
    console.error("Return result was Null of getNodePosition - calculating from pose");
    return null;
  }
  node_info["position"] = ret;
  return ret;

}

// Helper function to get neighbours
export async function getNeighbours(keyframeId: number, usePhysicalProximity = false): Promise<any[]> {



  const directNeighbours = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${QUERY_PREFIX}edges e 
              JOIN ${QUERY_PREFIX}edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN ${QUERY_PREFIX}nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND (e.type = 0 OR e.type = 1) AND (e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );

  if (usePhysicalProximity) {
    const result = await readDB(`WITH target_point AS (
    SELECT 
        x_trans, 
        y_trans, 
        z_trans
    FROM ${QUERY_PREFIX}nodes
    WHERE keyframe_id = ?
    )
    SELECT 
        *
    FROM ${QUERY_PREFIX}nodes rn
    JOIN target_point ON (
        SQRT(
            POWER(rn.y_trans - target_point.y_trans, 2) +
            POWER(rn.x_trans - target_point.x_trans, 2) +
            POWER(rn.z_trans - target_point.z_trans, 2)
        ) <= ?
    )
    WHERE rn.keyframe_id != ?;`, [keyframeId, TARGET_CLOSENESS / COORDS_TO_METRES, keyframeId])
    return [...new Set([...directNeighbours, ...result])]
  }

  return directNeighbours;
}

// Helper function to calculate distance between two positions
export function calculateXZDistance(pos1: [number, number, number], pos2: [number, number, number]): number | null {
  if (pos1.length < 3 || pos2.length < 3) {
    console.error("Invalid position array passed - has less then 3 values");
    return null;
  }
  const result = Math.sqrt(
    Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[2] - pos2[2], 2)
  );

  if (result == null || result < 0) {
    console.error("Distance calculation was NaN: [" + pos1 + "] [" + pos2 + "] " + result)
    return null;
  }

  return result;
}

export async function isNodeOutdoors(keyframeId: number) {
  const locData = await readDB(`SELECT location from ${QUERY_PREFIX}node_locations WHERE keyframe_id = ?`, [keyframeId], false)

  // If no location, take the more restrictive approach
  if (locData.length === 0) return false;

  return locData[0]["location"] === OUTDOORS_LOCATION_NAME;
}

// Helper function to delete a node and its edges
export async function replaceNode(keyframeId: number, position: [number, number, number], ignore_distance = false, isOutdoors = false) {
  const direct_neighbours = await readDB(
    `SELECT keyframe_id1 as keyframe_id FROM ${QUERY_PREFIX}edges WHERE keyframe_id0 = ? AND (type = 0 OR type = 1)`,
    [keyframeId], false
  )

  await writeDB("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];
    const pos = await getNodePosition(neighbour.keyframe_id)
    if (!pos) {
      throw new Error(`Unrecoverable error - Return result was Null of getNodePosition - neighbour: ${neighbour.keyframe_id}`)
    }

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      const newNeighbourPosition = await getNodePosition(new_neighbour.keyframe_id)
      if (!newNeighbourPosition) {
        throw new Error(`Unrecoverable error - Return result was Null of getNodePosition - neighbour: ${new_neighbour.keyframe_id}`)
      }
      const distance = calculateXZDistance(newNeighbourPosition, pos);
      if (distance == null) {
        throw new Error(`Unrecoverable error - Return result was Null of calculateXZDistance - neighbour: ${new_neighbour.keyframe_id}`)
      }
      const yDistance = Math.abs(newNeighbourPosition[2] - pos[2])
      if (!ignore_distance && (distance > (isOutdoors ? OUTDOORS_TARGET_CLOSENESS : TARGET_CLOSENESS) || yDistance > (isOutdoors ? OUTDOORS_Y_DIST_THRESHOLD : Y_DIST_THRESHOLD))) {
        console.debug("Cancelling delete - A new edge is too large - Distance:", distance, " ID:", neighbour.keyframe_id, " Compared ID:", new_neighbour.keyframe_id)
        await writeDB("ROLLBACK;")
        return false;
      }
      await writeDB(
        `INSERT INTO ${QUERY_PREFIX}edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await writeDB(
        `INSERT INTO ${QUERY_PREFIX}edges (keyframe_id1, keyframe_id0, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  await writeDB(
    `DELETE FROM ${QUERY_PREFIX}edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;`,
    [keyframeId, keyframeId]
  );
  await writeDB(`DELETE FROM ${QUERY_PREFIX}node_locations WHERE keyframe_id = ?`, [
    keyframeId,
  ]);
  await writeDB(`DELETE FROM ${QUERY_PREFIX}nodes WHERE keyframe_id = ?;`, [
    keyframeId,
  ]);

  await writeDB("COMMIT;")
  return true;
}

export function calculatePositionFromMatrix(
  matrix: number[]
): [number, number, number] {
  const m = new THREE.Matrix4();
  //@ts-ignore
  m.set(...matrix);
  m.invert();
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(m);
  return [
    -position.x * COORDS_TO_METRES,
    -position.y * COORDS_TO_METRES,
    position.z * COORDS_TO_METRES,
  ];
}

// Function to calculate image blur using sharp
export async function calculateImageSharpness(filePath: string): Promise<number> {
  try {
    const sharpness = await sharp(filePath)
      .stats()
      .then((stats) => {
        return stats.sharpness;
      });
    return sharpness;
  } catch (err) {
    console.error("Error processing image:", err);
    return 0; // Consider as most blurry if error
  }
}

export function convertTimestampToImagename(ts: Number | string) {
  return `${Number(ts).toFixed(5)}${KEYFRAME_IMG_EXTENSION}`
}

export async function getNextKeyframe(currentId: number) {
  let nextFrame: Array<{ keyframe_id: string; degree: number; ts: number }> =
    await readDB(
      `SELECT n.keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${QUERY_PREFIX}nodes n JOIN ${QUERY_PREFIX}edges e1 ON n.keyframe_id = e1.keyframe_id0
            WHERE n.keyframe_id > ? AND (e1.type = 0 OR e1.type = 1)  GROUP BY n.keyframe_id, n.ts LIMIT 1`,
      [currentId]
    );
  return nextFrame[0];
}
