
import { readDB, writeDB } from '../db';
import { BORDERING_FLOOR_POINT_DEFAULT_TYPE, COORDS_TO_METRES, EdgeType, TABLE_PREFIX, USE_TABLE_PREFIX } from '../consts'
import * as THREE from 'three'
// Helper function to get neighbours
export async function getNeighbours(keyframeId: number): Promise<any[]> {
  const result = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e 
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND (e.type >= ${EdgeType.Normal}) AND (e1.type >= ${EdgeType.Normal}) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );
  return result;
}



// Helper function to delete a node and its edges
export async function replaceNode(keyframeId: number) {

  const direct_neighbours = (
    await readDB(
      `SELECT keyframe_id1 as keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges WHERE keyframe_id0 = ? AND (type >= ${EdgeType.Normal})`,
      [keyframeId]
    )
  );

  await writeDB("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      await writeDB(
        `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = ${EdgeType.EdgeContraction};`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await writeDB(
        `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges (keyframe_id1, keyframe_id0, type) VALUES (?, ? 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = ${EdgeType.EdgeContraction};`,
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  // TODO: Gracefully handle deleteing border nodes
  const changes = await writeDB("DELETE FROM floorplan_points WHERE keyframe_id = ? AND NOT EXISTS (SELECT * FROM floorplan_points WHERE keyframe_id = ? AND type >= ?);", [keyframeId, keyframeId, BORDERING_FLOOR_POINT_DEFAULT_TYPE]);
  if (changes == 0) {
    await writeDB("ROLLBACK;")
    console.error("Tried to delete a border node - this will cause problems in other floors")
    return false;
  }
  await writeDB(
    `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;`,
    [keyframeId, keyframeId]
  );
  await writeDB(`DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations WHERE keyframe_id = ?`, [
    keyframeId,
  ]);
  await writeDB(`DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?;`, [
    keyframeId,
  ]);



  await writeDB("COMMIT;")
  return true;
}

export async function connectNodes(keyframe_id0: number, keyframe_id1: number) {
  try {
    await writeDB("BEGIN;")
    await writeDB(`INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 2) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING;`,
      [keyframe_id0, keyframe_id1]);
    await writeDB(`INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges(keyframe_id0, keyframe_id1, type) VALUES(?, ?, 2) ON CONFLICT(keyframe_id0, keyframe_id1) DO NOTHING;`,
      [keyframe_id1, keyframe_id0]
    );
    await writeDB("COMMIT;")
  }
  catch (e) {
    console.error("Failed to connect two points" + e)
    await writeDB("ROLLBACK;")
    return false;
  }
  return true;
}

export function BlobArrayToMatrix(array: Buffer): number[] {

  const BytesInDouble = 8
  const output = []
  const numDoubles = array.byteLength / BytesInDouble;
  for (let i = 0; i < numDoubles; i++) {
    const num = array.readDoubleLE(i * BytesInDouble) // Intel CPU uses LE
    output.push(num)
  }
  return output;
}

export function DbArrayToMatrix(array: string | number[]): number[] | null {
  let arr: number[] = []

  if (typeof array === 'string') {
    try {
      arr = JSON.parse(array.replace('{', '[').replace('}', ']'))
    }
    catch (e) {
      console.error('Failed to parse DbArrayToMatrix:', e)
      return null
    }
  }
  else {
    arr = array
  }

  if (arr && arr.length == 16) {
    return arr.map(Number)
  }
  return null
}

export async function disconnectNodes(keyframe_id0: number, keyframe_id1: number) {
  try {
    await writeDB("BEGIN;")
    await writeDB(`DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?);`,
      [keyframe_id0, keyframe_id1, keyframe_id1, keyframe_id0]);
    await writeDB("COMMIT;")
  }
  catch (e) {
    console.error("Failed to connect two points" + e)
    await writeDB("ROLLBACK;")
    return false;
  }
  return true;
}


// Helper function to get node position
export async function getNodePosition(keyframeId: number, use_trans = true): Promise<[number, number, number] | null> {
  const result = await readDB(
    `SELECT pose, x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?LIMIT 1;`,
    [keyframeId], true
  ) as any;
  if (!result) {
    return null;
  }

  if (use_trans) {
    const ret: [number, number, number] = [
      -result.x_trans * COORDS_TO_METRES,
      -result.y_trans * COORDS_TO_METRES,
      result.z_trans * COORDS_TO_METRES,
    ];
    if (!ret) {
      console.error("Return result was Null of getNodePosition - using trans");
      return null;
    }
    return ret;
  }

  const ret = calculatePositionFromMatrix(BlobArrayToMatrix(result.pose) ?? []);
  if (!ret) {
    console.error("Return result was Null of getNodePosition - using pose");
    return null;
  }
  return ret;
}

const USE_TRANS = true
export function getPositionOfNode(point: { pose: number[], x_trans: number, y_trans: number, z_trans: number }) {
  if (USE_TRANS) {
    return [-point.x_trans * COORDS_TO_METRES, -point.y_trans * COORDS_TO_METRES, point.z_trans * COORDS_TO_METRES]
  }
  return calculatePositionFromMatrix(point.pose)
}

export function calculatePositionFromMatrix(
  matrix_cw: number[]
): [number, number, number] | null {
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
