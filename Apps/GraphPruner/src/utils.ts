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
} from "./consts";

// Helper function to get node position
export async function getNodePosition(
  keyframeId: string,
  use_trans = true
): Promise<[number, number, number] | null> {
  const nodeInfo = await getNodeInfo(keyframeId, use_trans);
  if (!nodeInfo) return null;
  return nodeInfo["position"];
}

export async function getNumberOfNodes() {
  return await readDB(`SELECT COUNT(*) as total FROM nodes;`, [], true);
}

export async function getNodeInfo(
  keyframeId: string,
  use_trans = true
): Promise<NodeInfo | null> {
  const result = await readDB(
    `SELECT ts, pose, x_trans, y_trans, z_trans FROM ${DFLT_TABLE_PREFIX}nodes WHERE keyframe_id = ? LIMIT 1;`,
    [keyframeId],
    true
  );

  if (!result) {
    throw new Error("Could not find keyframe of ID: " + keyframeId);
  }

  const countOfLabels = await readDB(
    `SELECT COUNT(*) as total FROM ${DFLT_TABLE_PREFIX}special_labels WHERE keyframe_id = ?`,
    [keyframeId],
    true
  );
  const node_info = result;
  node_info["label_count"] = Number(countOfLabels.total ?? -1);

  if (use_trans) {
    const ret: [number, number, number] = [
      -node_info.x_trans * DFLT_COORDS_TO_METRES,
      -node_info.y_trans * DFLT_COORDS_TO_METRES,
      node_info.z_trans * DFLT_COORDS_TO_METRES,
    ];
    if (!ret) {
      console.error("Return result was Null of getNodePosition - using pose");
      return null;
    }
    node_info["position"] = ret;
  } else {
    const ret = calculatePositionFromMatrix(result[0]?.pose);
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
  keyframeId: number,
  neighbours: any[]
) {
  if (isNaN(Number(keyframeId)))
    throw new Error("NaN keyframeId passed to connect all neighbours");

  const zoneObject = await readDB(
    `SELECT zone FROM ${DFLT_TABLE_PREFIX}nodes WHERE keyframe_id = ? LIMIT 1;`,
    [keyframeId]
  );
  if (!zoneObject) throw new Error("Could not fetch keyframe: " + keyframeId);

  let edgesCreated = 0;

  for (const neighbour of neighbours) {
    try {
      await writeDB(
        `INSERT INTO ${DFLT_TABLE_PREFIX}edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?`,
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
        `INSERT INTO ${DFLT_TABLE_PREFIX}edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?`,
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
  keyframeId: number,
  proximity: number,
  vertical_prox: number,
  table_prefix: string
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
    FROM ${DFLT_TABLE_PREFIX}nodes
    WHERE keyframe_id = ?
    )

    SELECT
        *
        FROM ${DFLT_TABLE_PREFIX}nodes rn
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
  keyframeId: number,
  usePhysicalProximity = false
): Promise<any[]> {
  if (isNaN(Number(keyframeId))) throw new Error("NaN passed to getNeighbours");

  const directNeighbours = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${DFLT_TABLE_PREFIX}edges e 
              JOIN ${DFLT_TABLE_PREFIX}edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN ${DFLT_TABLE_PREFIX}nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND(e.type = 0 OR e.type = 1) AND(e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );

  if (usePhysicalProximity) {
    const results = await getPhysicalProximityNeighbours(
      keyframeId,
      DFLT_TARGET_CLOSENESS / DFLT_COORDS_TO_METRES
    );
    return [...new Set([...directNeighbours, ...results])];
  }

  return directNeighbours;
}

// Helper function to calculate distance between two positions
export function calculateXZDistance(
  pos1: [number, number, number],
  pos2: [number, number, number]
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

export async function isNodeOutdoors(keyframeId: number) {
  if (isNaN(Number(keyframeId)))
    throw new Error("NaN passed to isNodeOutdoors");
  const locData = await readDB(
    `SELECT location from ${DFLT_TABLE_PREFIX}node_locations WHERE keyframe_id = ? `,
    [keyframeId],
    false
  );

  // If no location, take the more restrictive approach
  if (locData.length === 0) return false;

  return locData[0]["location"] === DFLT_OUTDOORS_LOCATION_NAME;
}

// Helper function to delete a node and its edges
export async function replaceNode(
  keyframeId: number,
  position: [number, number, number],
  ignore_distance = false,
  isOutdoors = false
) {
  if (isNaN(Number(keyframeId))) throw new Error("NaN passed to replaceNode");
  const direct_neighbours = await readDB(
    `SELECT keyframe_id1 as keyframe_id FROM ${DFLT_TABLE_PREFIX}edges WHERE keyframe_id0 = ? AND(type = 0 OR type = 1)`,
    [keyframeId],
    false
  );

  await writeDB("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];
    const pos = await getNodePosition(neighbour.keyframe_id);
    if (!pos) {
      throw new Error(
        `Unrecoverable error - Return result was Null of getNodePosition - neighbour: ${neighbour.keyframe_id} `
      );
    }

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      const newNeighbourPosition = await getNodePosition(
        new_neighbour.keyframe_id
      );
      if (!newNeighbourPosition) {
        throw new Error(
          `Unrecoverable error - Return result was Null of getNodePosition - neighbour: ${new_neighbour.keyframe_id} `
        );
      }
      const distance = calculateXZDistance(newNeighbourPosition, pos);
      if (distance == null) {
        throw new Error(
          `Unrecoverable error - Return result was Null of calculateXZDistance - neighbour: ${new_neighbour.keyframe_id} `
        );
      }
      const yDistance = Math.abs(newNeighbourPosition[2] - pos[2]);
      if (
        !ignore_distance &&
        (distance >
          (isOutdoors
            ? DFLT_OUTDOORS_TARGET_CLOSENESS
            : DFLT_TARGET_CLOSENESS) ||
          yDistance >
            (isOutdoors
              ? DFLT_OUTDOORS_Y_DIST_THRESHOLD
              : DFLT_Y_DIST_THRESHOLD))
      ) {
        console.debug(
          "Cancelling delete - A new edge is too large - Distance:",
          distance,
          " ID:",
          neighbour.keyframe_id,
          " Compared ID:",
          new_neighbour.keyframe_id
        );
        await writeDB("ROLLBACK;");
        return false;
      }
      await writeDB(
        `INSERT INTO ${DFLT_TABLE_PREFIX}edges(keyframe_id0, keyframe_id1, type) VALUES(?, ?, 1) ON CONFLICT(keyframe_id0, keyframe_id1) DO UPDATE SET type = 1; `,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await writeDB(
        `INSERT INTO ${DFLT_TABLE_PREFIX}edges(keyframe_id1, keyframe_id0, type) VALUES(?, ?, 1) ON CONFLICT(keyframe_id0, keyframe_id1) DO UPDATE SET type = 1; `,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  await writeDB(
    `DELETE FROM ${DFLT_TABLE_PREFIX}edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?; `,
    [keyframeId, keyframeId]
  );
  await writeDB(
    `DELETE FROM ${DFLT_TABLE_PREFIX}node_locations WHERE keyframe_id = ? `,
    [keyframeId]
  );
  await writeDB(
    `DELETE FROM ${DFLT_TABLE_PREFIX}nodes WHERE keyframe_id = ?; `,
    [keyframeId]
  );

  await writeDB("COMMIT;");
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
    -position.x * DFLT_COORDS_TO_METRES,
    -position.y * DFLT_COORDS_TO_METRES,
    position.z * DFLT_COORDS_TO_METRES,
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

export function convertTimestampToImagename(ts: Number | string) {
  if (isNaN(Number(ts)))
    throw new Error("NaN passed as timestamp for convertTimestampToImagename");

  return `${Number(ts).toFixed(5)}${DFLT_KEYFRAME_IMG_EXTENSION} `;
}

export async function getNextKeyframe(currentId: number) {
  if (isNaN(Number(currentId)))
    throw new Error("NaN passed to getNextKeyframe");
  return await readDB(
    `SELECT keyframe_id, ts FROM ${DFLT_TABLE_PREFIX}nodes WHERE keyframe_id > ? LIMIT 1`,
    [currentId],
    true
  );
}
