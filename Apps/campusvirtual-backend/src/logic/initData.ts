import { writeDB, readDB } from '../db'
import { FLOOR_POINT_DEFAULT_TYPE, BORDERING_FLOOR_POINT_DEFAULT_TYPE, TABLE_PREFIX, USE_TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE } from '../consts'
export default async function initDB(quitIfTablesExist = false) {
  try {
    console.debug("Initalising data...")
    await writeDB(`CREATE TABLE floorplan_images (
      location TEXT PRIMARY KEY,
      path TEXT DEFAULT ''
      );`);

    await writeDB(`CREATE TABLE floorplan_points (
      location TEXT NOT NULL,
      x DOUBLE PRECISION DEFAULT 0 NOT NULL,
      y DOUBLE PRECISION DEFAULT 0 NOT NULL,
      keyframe_id INTEGER REFERENCES ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes (keyframe_id),
      type INTEGER DEFAULT 0 NOT NULL,
      PRIMARY KEY (keyframe_id, location)
    );`);
  }
  catch (e) {

    console.info("Already built floorplan_images and floorplan_points!")
    if (quitIfTablesExist) {
      console.info("Skipping map data init!")
      return;
    }
  }
  try {
    await writeDB("BEGIN;");
    // Do by location to avoid causing a possible crash/memory overload
    const locationsResult = await readDB(`SELECT DISTINCT location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations;`)
    const locations = locationsResult.map((location: { location: string }) => location.location);
    console.debug("Locations:", locations)

    for (const location of locations) {
      const nodes = await getFloorNodes(location)
      const borderNodes = await getBorderNodes(location);
      console.info(`Location ${location} - Nodes: ${nodes.length}, Border Nodes: ${borderNodes.length}`)

      const combined_nodes = [...nodes, ...borderNodes]

      const maxX = Math.max(...combined_nodes.map((node: { x_trans: number }) => node.x_trans))
      const maxZ = Math.max(...combined_nodes.map((node: { z_trans: number }) => node.z_trans))
      const minX = Math.min(...combined_nodes.map((node: { x_trans: number }) => node.x_trans))
      const minZ = Math.min(...combined_nodes.map((node: { z_trans: number }) => node.z_trans))

      const clampToPostive = (val: number) => {
        return Math.max(0, Math.min(1, val))
      }

      for (const node of nodes) {
        // Don't need to wait for this
        const initX = clampToPostive((node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((node.z_trans - minZ) / (maxZ - minZ))
        const success = insertPointOnMap(location, node.keyframe_id, FLOOR_POINT_DEFAULT_TYPE, initX, initY)
        if (!success) throw new Error(`Rollback - Failed to insert point ${node.keyframe_id} into map!`)
      }

      for (const border_node of borderNodes) {
        const initX = clampToPostive((border_node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((border_node.z_trans - minZ) / (maxZ - minZ))
        const success = insertPointOnMap(location, border_node.keyframe_id, BORDERING_FLOOR_POINT_DEFAULT_TYPE, initX, initY)
        if (!success) throw new Error(`Rollback - Failed to insert border point ${border_node.keyframe_id} into map!`)
      }

      const success = await insertLocationIntoImages(location)
      if (!success) throw new Error(`Rollback - Failed to insert location ${location} into images!`)
    }

    await writeDB("COMMIT;")
    console.debug("Sucessfully initalised the data!")
  }
  catch (e) {
    await writeDB("ROLLBACK;");
    console.error("Data initialisation failed: ", e)
  }
}

/**
 * Insert point onto the associated map
 * @param location - Location group string
 * @param keyframe_id - Keyframe ID
 * @param type - Type of floor point (e.g., FLOOR_POINT_DEFAULT_TYPE)
 * @param x - Percentage coordinates (0-1)
 * @param y - Percentage coordinates (0-1)
 * @returns success boolean
 */
async function insertPointOnMap(location: string, keyframe_id: number, type: number, x: number, y: number) {
  if (isNaN(Number(x)) || isNaN(Number(y))) {
    console.error("Invalid coordinates provided for point insertion.")
    return false;
  }
  if (x < 0 || y < 0 || x > 1 || y > 1) {
    console.error("Coordinates are out of the map range.")
    return false;
  }
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) {
    console.error("Location is too long.")
    return false;
  }
  if (isNaN(Number(keyframe_id))) {
    console.error("Keyframe ID is invalid:" + keyframe_id)
    return false;
  }
  if (isNaN(Number(type))) {
    console.error("Type is invalid:" + type)
    return false;
  }

  return (await writeDB(`INSERT OR IGNORE INTO floorplan_points (location, keyframe_id, type, x, y) VALUES (?, ?, ?, ?, ?);`, [location, keyframe_id, type, x, y])) > 0;
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function insertLocationIntoImages(location: string) {
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) throw new Error("Invalid Location")

  await writeDB(`INSERT OR IGNORE INTO floorplan_images (location) VALUES (?);`, [location])
  return true; // IGNORE is acceptable
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function getFloorNodes(location: string): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) throw new Error("Invalid Location")

  const nodesResult = await readDB(`SELECT n.keyframe_id, l.location, n.x_trans, n.z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON l.keyframe_id = n.keyframe_id WHERE l.location = ?;`, [location])
  return nodesResult
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function getBorderNodes(location: string): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) throw new Error("Invalid Location")

  const borderNodesResult = await readDB(`SELECT keyframe_id1 as keyframe_id, l2.location, n.x_trans, n.z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e 
                    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l 
                    ON e.keyframe_id0 = l.keyframe_id 
                    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l2 ON e.keyframe_id1 = l2.keyframe_id
                    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON n.keyframe_id = e.keyframe_id1
                    WHERE l.location = ? AND l2.location <> ?;
                    `, [location, location])

  return borderNodesResult
}