
import { BORDERING_FLOOR_POINT_DEFAULT_TYPE, COORDS_TO_METRES } from './consts'
import * as THREE from 'three'
// Helper function to get neighbours
export async function getNeighbours(keyframeId: number): Promise<any[]> {
  const result = await readDB(
    `SELECT e.keyframe_id1 as keyframe_id, n.ts, COUNT(e1.keyframe_id1) as degree FROM refined_edges e 
              JOIN refined_edges e1 ON e.keyframe_id1 = e1.keyframe_id0
              JOIN refined_nodes n ON e.keyframe_id1 = n.keyframe_id 
              WHERE e.keyframe_id0 = ? AND (e.type = 0 OR e.type = 1) AND (e1.type = 0 OR e1.type = 1) 
              GROUP BY e.keyframe_id1, n.ts`,
    [keyframeId]
  );
  return result;
}



// Helper function to delete a node and its edges
export async function replaceNode(keyframeId: number) {

  const direct_neighbours = (
    await readDB(
      "SELECT keyframe_id1 as keyframe_id FROM refined_edges WHERE keyframe_id0 = ? AND (type = 0 OR type = 1)",
      [keyframeId]
    )
  );

  await writeDB("BEGIN;");

  for (const neighbour_id in direct_neighbours) {
    const neighbour = direct_neighbours[neighbour_id];

    for (const new_neighbour of direct_neighbours.slice(neighbour_id)) {
      if (new_neighbour.keyframe_id == neighbour.keyframe_id) continue;
      await writeDB(
        "INSERT INTO refined_edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;",
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
      await writeDB(
        "INSERT INTO refined_edges (keyframe_id1, keyframe_id0, type) VALUES (?, ? 1) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type = 1;",
        [neighbour.keyframe_id, new_neighbour.keyframe_id]
      );
    }
  }

  // TODO: Gracefully handle deleteing border nodes
  const changes = await writeDB("DELETE FROM floorplan_points WHERE keyframe_id = ? AND NOT EXISTS (SELECT * FROM floorplan_points WHERE keyframe_id = ? AND type >= ?);", [keyframeId, BORDERING_FLOOR_POINT_DEFAULT_TYPE]);
  if (changes == 0) {
    await writeDB("ROLLBACK;")
    console.error("Tried to delete a border node - this will cause problems in other floors")
    return false;
  }
  await writeDB(
    "DELETE FROM refined_edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;",
    [keyframeId, keyframeId]
  );
  await writeDB("DELETE FROM refined_node_locations WHERE keyframe_id = ?", [
    keyframeId,
  ]);
  await writeDB("DELETE FROM refined_nodes WHERE keyframe_id = ?;", [
    keyframeId,
  ]);



  await writeDB("COMMIT;")
  return true;
}

export async function connectNodes(keyframe_id0: number, keyframe_id1: number) {
  try {
    await writeDB("BEGIN;")
    await writeDB(`INSERT INTO refined_edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 2) ON CONFLICT (keyframe_id0, keyframe_id1) DO NOTHING;`,
      [keyframe_id0, keyframe_id1]);
    await writeDB(`INSERT INTO refined_edges(keyframe_id0, keyframe_id1, type) VALUES(?, ?, 2) ON CONFLICT(keyframe_id0, keyframe_id1) DO NOTHING;`,
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
    await writeDB(`DELETE FROM refined_edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?);`,
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


import path from 'path'
import { readDB, writeDB } from './db';

export function stripDirectoryTraversal(user_input: string, root: string) {
  var safe_input = path.normalize(user_input);
  if (safe_input.indexOf(root) !== 0) {
    return false;
  }
  return safe_input;
}

// Helper function to get node position
export async function getNodePosition(keyframeId: number, use_trans = true) {
  const result = await readDB(
    "SELECT pose, x_trans, y_trans, z_trans FROM refined_nodes WHERE keyframe_id = ?LIMIT 1;",
    [keyframeId], true
  ) as any;
  if (result) {
    throw new Error("Could not find keyframe of ID: " + keyframeId);
  }

  if (use_trans) {
    const ret: [number, number, number] = [
      result.x_trans * COORDS_TO_METRES,
      result.y_trans * COORDS_TO_METRES,
      result.z_trans * COORDS_TO_METRES,
    ];
    if (!ret) throw new Error("Return result was Null of getNodePosition");
    return ret;
  }

  const ret = calculatePositionFromMatrix(DbArrayToMatrix(result.pose) ?? []);
  if (!ret)
    throw new Error(
      "Return result was Null of getNodePosition - calculating from pose"
    );
  return ret;
}

export function calculatePositionFromMatrix(
  matrix: number[]
): [number, number, number] | null {
  if (!matrix || matrix.length != 16) {
    return null;
  }

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
