import sharp from "sharp";

import * as THREE from "three";
import { readDB, writeDB } from "./db";
import {
  NodeInfo,
  DFLT_TABLE_PREFIX,
  DFLT_COORDS_TO_METRES,
  EdgeType,
  DFLT_TARGET_CLOSENESS,
  DFLT_OUTDOORS_LOCATION_NAME,
  DFLT_OUTDOORS_TARGET_CLOSENESS,
  DFLT_OUTDOORS_Y_DIST_THRESHOLD,
  DFLT_Y_DIST_THRESHOLD,
  DFLT_KEYFRAME_IMG_EXTENSION,
  Config,
  ThreeNumbersArray,
} from "./consts";

/**
 * Get XYZ position of a node - is convenience interface on top of getNodeInfo, so is not a faster method
 * @param config
 * @param keyframeId
 * @param use_trans
 * @returns
 */
export async function getNodePosition(
  config: Config,
  keyframeId: string,
  use_trans = true
): Promise<ThreeNumbersArray | null> {
  const nodeInfo = await getNodeInfo(config, keyframeId, use_trans);
  if (!nodeInfo) return null;
  return nodeInfo["position"];
}

/**
 * Get Number of keyframe nodes from DB
 * @returns number
 */
export async function getNumberOfNodes() {
  return await readDB(`SELECT COUNT(*) as total FROM nodes;`, [], true);
}

/**
 * Get node information, including if it has any labels from other_nodes
 * @param config
 * @param keyframeId
 * @param use_trans
 * @returns
 */
export async function getNodeInfo(
  config: Config,
  keyframeId: string,
  use_trans = true
): Promise<NodeInfo | null> {
  const result = await readDB(
    `SELECT ts, pose, x_trans, y_trans, z_trans FROM ${config.table_prefix}nodes WHERE keyframe_id = ? LIMIT 1;`,
    [keyframeId],
    true
  );

  if (!result) {
    throw new Error("Could not find keyframe of ID: " + keyframeId);
  }

  // Check for labels in other_nodes table first, fallback to user_defined_labels
  const countOfLabels = await readDB(
    `SELECT COUNT(*) as total FROM ${config.table_prefix}other_nodes WHERE ref_id = ?`,
    [keyframeId],
    true
  );
  
  let labelCount = Number(countOfLabels.total ?? 0);
  
  const node_info = result;
  node_info["label_count"] = labelCount;

  if (use_trans) {
    const ret: ThreeNumbersArray = [
      -node_info.x_trans * config.coords_to_metres,
      -node_info.y_trans * config.coords_to_metres,
      node_info.z_trans * config.coords_to_metres,
    ];
    if (!ret) {
      console.error("Return result was Null of getNodePosition - using pose");
      return null;
    }
    node_info["position"] = ret;
  } else {
    const ret = calculatePositionFromMatrix(config, result[0]?.pose);
    if (!ret) {
      console.error(
        "Return result was Null of getNodePosition - calculating from pose"
      );
      return null;
    }
    node_info["position"] = ret;
  }

  return node_info;
}

export async function connectAllNeighboursIfNotAlready(
  config: Config,
  keyframeId: number,
  neighbours: any[]
) {
  if (isNaN(Number(keyframeId)))
    throw new Error("NaN keyframeId passed to connect all neighbours");

  const zoneObject = await readDB(
    `SELECT zone FROM ${config.table_prefix}nodes WHERE keyframe_id = ? LIMIT 1;`,
    [keyframeId]
  );
  if (!zoneObject) throw new Error("Could not fetch keyframe: " + keyframeId);

  let edgesCreated = 0;

  for (const neighbour of neighbours) {
    try {
      await writeDB(
        `INSERT INTO ${config.table_prefix}edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?`,
        [
          keyframeId,
          neighbour.keyframe_id,
          EdgeType.EdgeContraction,
          zoneObject.zone,
          EdgeType.EdgeContraction,
          EdgeType.Covisibility,
        ]
      ).then((value) => {
        if (value > 0) edgesCreated++;
      });
      await writeDB(
        `INSERT INTO ${config.table_prefix}edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?`,
        [
          neighbour.keyframe_id,
          keyframeId,
          EdgeType.EdgeContraction,
          zoneObject.zone,
          EdgeType.EdgeContraction,
          EdgeType.Covisibility,
        ]
      );
    } catch (e) {
      console.error("Error:" + e);
    }
  }
  return edgesCreated;
}

export async function getPhysicalProximityNeighbours(
  config: Config,
  keyframeId: number,
  proximity: number,
  vertical_prox: number
): Promise<any[]> {
  if (
    isNaN(Number(keyframeId)) ||
    isNaN(Number(proximity)) ||
    isNaN(Number(vertical_prox))
  )
    throw new Error(
      "Na passed to getPhysicalProximity - ID: " +
        keyframeId +
        " | Horizontal Proximity: " +
        proximity +
        " | Vertical Prox: " +
        vertical_prox
    );

  const result = await readDB(
    `WITH target_point AS(
        SELECT 
        x_trans,
        y_trans,
        z_trans
    FROM ${config.table_prefix}nodes
    WHERE keyframe_id = ?
    )

    SELECT
        *
        FROM ${config.table_prefix}nodes rn
    JOIN target_point ON(
          SQRT(
            (POWER(rn.x_trans - target_point.x_trans, 2)) +
            (POWER(rn.z_trans - target_point.z_trans, 2))
          ) <= ?
           AND (ABS(rn.y_trans - target_point.y_trans)) <= ?
        )
    WHERE rn.keyframe_id != ?; `,
    [keyframeId, proximity, vertical_prox, keyframeId]
  );
  return result;
}

// Helper function to get neighbours
export async function getNeighbours(
  config: Config,
  keyframeId: number,
  usePhysicalProximity = false
): Promise<any[]> {
  if (isNaN(Number(keyframeId))) throw new Error("NaN passed to getNeighbours");

  const directNeighbours = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${config.table_prefix}edges e 
              JOIN ${config.table_prefix}edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN ${config.table_prefix}nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND(e.type = 0 OR e.type = 1) AND(e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );

  if (usePhysicalProximity) {
    const results = await getPhysicalProximityNeighbours(
      config,
      keyframeId,
      config.outer_ring,
      config.y_dist_thresh
    );
    return [...new Set([...directNeighbours, ...results])];
  }

  return directNeighbours;
}

// Helper function to calculate distance between two positions
export function calculateXZDistance(
  pos1: ThreeNumbersArray,
  pos2: ThreeNumbersArray
): number | null {
  if (pos1.length < 3 || pos2.length < 3) {
    console.error("Invalid position array passed - has less then 3 values");
    return null;
  }
  const result = Math.sqrt(
    Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[2] - pos2[2], 2)
  );

  if (result == null || result < 0) {
    console.error(
      "Distance calculation was NaN: [" + pos1 + "] [" + pos2 + "] " + result
    );
    return null;
  }

  return result;
}

export async function isNodeOutdoors(config: Config, keyframeId: number) {
  if (isNaN(Number(keyframeId)))
    throw new Error("NaN passed to isNodeOutdoors");
  const locData = await readDB(
    `SELECT location from ${config.table_prefix}node_locations WHERE keyframe_id = ? `,
    [keyframeId],
    false
  );

  // If no location, take the more restrictive approach
  if (locData.length === 0) return false;

  return locData[0]["location"] === DFLT_OUTDOORS_LOCATION_NAME;
}

/**
 * 4x4 pose matrix to XYZ
 * @param config
 * @param matrix
 * @returns
 */
export function calculatePositionFromMatrix(
  config: Config,
  matrix: number[]
): ThreeNumbersArray {
  const m = new THREE.Matrix4();
  //@ts-ignore
  m.set(...matrix);
  m.invert();
  const position = new THREE.Vector3();
  position.setFromMatrixPosition(m);
  return [
    -position.x * config.coords_to_metres,
    -position.y * config.coords_to_metres,
    position.z * config.coords_to_metres,
  ];
}

// Function to calculate image blur using sharp
export async function calculateImageSharpness(
  filePath: string
): Promise<number> {
  try {
    const sharpness = await sharp(filePath.trim())
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

export function convertTimestampToImagename(
  config: Config,
  ts: Number | string
) {
  if (isNaN(Number(ts)))
    throw new Error("NaN passed as timestamp for convertTimestampToImagename");

  return `${Number(ts).toFixed(5)}${config.img_ext}`.trim();
}

export async function getNextKeyframe(config: Config, currentId: number) {
  if (isNaN(Number(currentId)))
    throw new Error("NaN passed to getNextKeyframe");
  return await readDB(
    `SELECT keyframe_id, ts FROM ${config.table_prefix}nodes WHERE keyframe_id > ? LIMIT 1`,
    [currentId],
    true
  );
}
