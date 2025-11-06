import { readDB, writeDB } from "../db";
import {
  BORDERING_FLOOR_POINT_DEFAULT_TYPE,
  COORDS_TO_METRES,
  EdgeType,
  TABLE_PREFIX,
  USE_TABLE_PREFIX,
} from "../consts";
import * as THREE from "three";
import logger from "../logger";
import { ThreeNumbersArray } from "../types";
// Helper function to get neighbours
export async function getNeighbours(keyframeId: number, get_elevator_neighbours = false): Promise<any[]> {
  // Get regular neighbours from edges table
  const regularNeighbours = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges e 
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND (e.type >= ${EdgeType.Normal
    }) AND (e1.type >= ${EdgeType.Normal}) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );


  let elevatorNeighbours: any[] = []
  if (get_elevator_neighbours) {
    // Get elevator neighbours via other_nodes and elevator_edges
    elevatorNeighbours = await readDB(
      `SELECT DISTINCT n2.keyframe_id, n2.ts, 1 as degree
      FROM nodes n
      JOIN other_nodes on1 ON n.keyframe_id = on1.ref_id
      JOIN elevator_edges ee ON (on1.id = ee.id0 OR on1.id = ee.id1)
      JOIN other_nodes on2 ON (on2.id = ee.id0 OR on2.id = ee.id1)
      JOIN nodes n2 ON on2.ref_id = n2.keyframe_id
      WHERE n.keyframe_id = ? 
      AND on1.id != on2.id
      AND on1.type = 1 
        AND on2.type = 1`,
        [keyframeId]
      );
  }
  // Combine and deduplicate neighbours
  const allNeighbours = [...regularNeighbours, ...elevatorNeighbours];
  const uniqueNeighbours = new Map();
  
  for (const neighbour of allNeighbours) {
    if (!uniqueNeighbours.has(neighbour.keyframe_id)) {
      uniqueNeighbours.set(neighbour.keyframe_id, neighbour);
    }
  }
  
  return Array.from(uniqueNeighbours.values());
}

// Helper function to delete a node and its edges
export async function replaceNode(keyframeId: number) {
  const direct_neighbours = await readDB(
    `SELECT keyframe_id1 as keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges WHERE keyframe_id0 = ? AND (type >= ${EdgeType.Normal})`,
    [keyframeId]
  );

  await writeDB("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      await writeDB(
        `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
        }edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = ${EdgeType.EdgeContraction
        };`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await writeDB(
        `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
        }edges (keyframe_id1, keyframe_id0, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = ${EdgeType.EdgeContraction
        };`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  // TODO: Gracefully handle deleteing border nodes
  const changes = await writeDB(
    `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }floorplan_points WHERE keyframe_id = ? AND NOT EXISTS (SELECT * FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }floorplan_points WHERE keyframe_id = ? AND type >= ?);`,
    [keyframeId, keyframeId, BORDERING_FLOOR_POINT_DEFAULT_TYPE]
  );
  if (changes == 0) {
    await writeDB("ROLLBACK;");
    logger.warn(
      "Tried to delete a border node - this will cause problems in other floors"
    );
    return false;
  }
  await writeDB(
    `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;`,
    [keyframeId, keyframeId]
  );
  await writeDB(
    `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }node_locations WHERE keyframe_id = ?`,
    [keyframeId]
  );
  await writeDB(
    `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }nodes WHERE keyframe_id = ?;`,
    [keyframeId]
  );

  await writeDB("COMMIT;");
  return true;
}

export async function connectNodes(keyframe_id0: number, keyframe_id1: number) {
  try {
    await writeDB("BEGIN;");
    await writeDB(
      `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
      }edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 2) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING;`,
      [keyframe_id0, keyframe_id1]
    );
    await writeDB(
      `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
      }edges(keyframe_id0, keyframe_id1, type) VALUES(?, ?, 2) ON CONFLICT(keyframe_id0, keyframe_id1) DO NOTHING;`,
      [keyframe_id1, keyframe_id0]
    );
    await writeDB("COMMIT;");
  } catch (e) {
    logger.warn(
      `[connectNodes] Failed to connect two points - 1: ${keyframe_id0} 2: ${keyframe_id1} error: ${e}`
    );
    await writeDB("ROLLBACK;");
    return false;
  }
  return true;
}

export function BlobArrayToMatrix(array: Buffer): number[] {
  const BytesInDouble = 8;
  const output = [];
  const numDoubles = array.byteLength / BytesInDouble;
  for (let i = 0; i < numDoubles; i++) {
    const num = array.readDoubleLE(i * BytesInDouble); // Intel CPU uses LE
    output.push(num);
  }
  return output;
}

export function DbArrayToMatrix(array: string | number[]): number[] | null {
  let arr: number[] = [];

  if (typeof array === "string") {
    try {
      arr = JSON.parse(array.replace("{", "[").replace("}", "]"));
    } catch (e) {
      logger.error(
        `[DbArrayToMatrix] Failed to parse DbArrayToMatrix - array: ${array} error: ${e}`
      );
      return null;
    }
  } else {
    arr = array;
  }

  if (arr && arr.length == 16) {
    return arr.map(Number);
  }
  return null;
}

export async function disconnectNodes(
  keyframe_id0: number,
  keyframe_id1: number
) {
  try {
    await writeDB("BEGIN;");
    await writeDB(
      `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
      }edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?);`,
      [keyframe_id0, keyframe_id1, keyframe_id1, keyframe_id0]
    );
    await writeDB("COMMIT;");
  } catch (e) {
    logger.error(
      `[disconnectNodes] Failed to connect two points - 1: ${keyframe_id0} 2: ${keyframe_id1} Error:${e}`
    );
    await writeDB("ROLLBACK;");
    return false;
  }
  return true;
}

// Helper function to get node position
export async function getNodePosition(
  keyframeId: number,
  use_trans = true
): Promise<ThreeNumbersArray | null> {
  const result = (await readDB(
    `SELECT pose, x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }nodes WHERE keyframe_id = ?LIMIT 1;`,
    [keyframeId],
    true
  )) as any;
  if (!result) {
    logger.warn(
      `[getNodePosition] could not get node data for id: ${keyframeId} when using translation: ${use_trans}`
    );
    return null;
  }

  if (use_trans) {
    const ret: ThreeNumbersArray = [
      -result.x_trans * COORDS_TO_METRES,
      -result.y_trans * COORDS_TO_METRES,
      result.z_trans * COORDS_TO_METRES,
    ];
    if (!ret) {
      logger.error(
        "[getNodePosition] Return result was Null of getNodePosition - using trans"
      );
      return null;
    }
    return ret;
  }

  const ret = calculatePositionFromMatrix(BlobArrayToMatrix(result.pose) ?? []);
  if (!ret) {
    logger.error(
      "[getNodePosition] Return result was Null of getNodePosition - using pose"
    );
    return null;
  }
  return ret;
}

const USE_TRANS = true;
export function getPositionOfNode(point: {
  pose: number[];
  x_trans: number;
  y_trans: number;
  z_trans: number;
}) {
  if (USE_TRANS) {
    return [
      -point.x_trans * COORDS_TO_METRES,
      -point.y_trans * COORDS_TO_METRES,
      point.z_trans * COORDS_TO_METRES,
    ];
  }
  return calculatePositionFromMatrix(point.pose);
}

export function calculatePositionFromMatrix(
  matrix_cw: number[]
): ThreeNumbersArray | null {
  if (!matrix_cw || matrix_cw.length != 16) {
    return null;
  }

  const m_wc = new THREE.Matrix4();
  //@ts-ignore
  m_wc.set(...matrix_cw);
  m_wc.invert();
  const position_wc = new THREE.Vector3();
  position_wc.setFromMatrixPosition(m_wc);
  return [
    -position_wc.x * COORDS_TO_METRES,
    -position_wc.y * COORDS_TO_METRES,
    position_wc.z * COORDS_TO_METRES,
  ];
}

export function convertToUICoordinateScale(node: {
  x_trans: number;
  y_trans: number;
  z_trans: number;
}) {
  // return node
  if (!node || !node.x_trans || !node.y_trans || !node.z_trans) {
    return node;
  }
  const newNode = {
    ...node,
    x_trans: Number(node.x_trans) * Number(COORDS_TO_METRES),
    y_trans: Number(node.y_trans) * Number(COORDS_TO_METRES),
    z_trans: Number(node.z_trans) * Number(COORDS_TO_METRES),
  };
  return newNode;
}
