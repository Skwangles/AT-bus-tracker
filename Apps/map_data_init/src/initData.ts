import { USE_TABLE_PREFIX, TABLE_PREFIX, FLOOR_POINT_DEFAULT_TYPE, BORDERING_FLOOR_POINT_DEFAULT_TYPE, REASONABLE_MAX_STRING_SIZE } from "./consts";
import { writeDB, readDB } from "./db";
import logger from "./logger";

export default async function initDB(quitIfTablesExist = false) {
  try {
    logger.debug("[initMap] Initalising data...")
    await writeDB(`CREATE TABLE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images (
      location TEXT PRIMARY KEY,
      path TEXT DEFAULT ''
      );`);

    await writeDB(`CREATE TABLE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points (
      location TEXT NOT NULL,
      x DOUBLE PRECISION DEFAULT 0 NOT NULL,
      y DOUBLE PRECISION DEFAULT 0 NOT NULL,
      keyframe_id INTEGER REFERENCES ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes (keyframe_id) ON DELETE CASCADE,
      type INTEGER DEFAULT 0 NOT NULL,
      PRIMARY KEY (keyframe_id, location)
    );`);
  }
  catch (e) {

    logger.info(`[initMap] Already built ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images and${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points - Exception: ${e}`)
    if (quitIfTablesExist) {
      logger.info("[initMap] Skipping map data init!")
      return;
    }
  }
  try {
    await writeDB("BEGIN;");
    // Do by location to avoid causing a possible crash/memory overload
    const locationsResult = await readDB(`SELECT DISTINCT location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations;`)
    const locations = locationsResult.map((location: { location: string }) => location.location);
    logger.debug(`[initMap] Locations: ${locations}`)

    for (const location of locations) {
      const nodes = await getFloorNodes(location)
      const borderNodes = await getBorderNodes(location);
      logger.debug(`[initMap] Location ${location} - Nodes: ${nodes.length}, Border Nodes: ${borderNodes.length}`)

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
        logger.verbose(`[initDB] Floor Node: ${JSON.stringify(node)}`)
        const initX = clampToPostive((node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((node.z_trans - minZ) / (maxZ - minZ))
        const success = insertPointOnMap(location, node.keyframe_id, FLOOR_POINT_DEFAULT_TYPE, initX, initY)
        if (!success) {
          logger.error("[initMap] Rolling back - Failed to insert point")
          throw new Error(`Rollback - Failed to insert point ${node.keyframe_id} into map!`)
        }
      }

      for (const border_node of borderNodes) {
        logger.verbose(`[initDB] Border Node: ${JSON.stringify(border_node)}`)
        const initX = clampToPostive((border_node.x_trans - minX) / (maxX - minX))
        const initY = clampToPostive((border_node.z_trans - minZ) / (maxZ - minZ))
        const success = insertPointOnMap(location, border_node.keyframe_id, BORDERING_FLOOR_POINT_DEFAULT_TYPE, initX, initY)
        if (!success) {
          logger.error("[initMap] Rolling back - Failed to insert border point")
          throw new Error(`Rollback - Failed to insert border point ${border_node.keyframe_id} into map!`)
        }
      }

      const success = await insertLocationIntoImages(location)

      if (!success) {
        logger.error("[initMap] Rolling back - Failed to insert location into images")
        throw new Error(`Rollback - Failed to insert location ${location} into images!`)
      }
    }

    await writeDB("COMMIT;")
    logger.debug("[initMap] Sucessfully initalised the data!")
  }
  catch (e) {
    await writeDB("ROLLBACK;");
    logger.error(`[initMap] Data initialisation failed: ${e}`)
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
    logger.error(`[initMap - insertPointOnMap] Invalid coordinates provided for point insertion - x:${x} y:${y}`)
    return false;
  }
  if (x < 0 || y < 0 || x > 1 || y > 1) {
    logger.error(`[initMap - insertPointOnMap] Coordinates are out of the map range - x: ${x} y: ${y}`)
    return false;
  }
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) {
    logger.error("[initMap - insertPointOnMap] Location is too long.")
    return false;
  }
  if (isNaN(Number(keyframe_id))) {
    logger.error(`[initMap - insertPointOnMap] Keyframe ID is invalid: ${keyframe_id}`)
    return false;
  }
  if (isNaN(Number(type))) {
    logger.error(`[initMap - insertPointOnMap] Type is invalid: ${type}`)
    return false;
  }

  return (await writeDB(`INSERT OR IGNORE INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points (location, keyframe_id, type, x, y) VALUES (?, ?, ?, ?, ?);`, [location, keyframe_id, type, x, y])) > 0;
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function insertLocationIntoImages(location: string) {
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) {
    logger.error(`[getLocationIntoImages] Invalid location: ${location}`)
    throw new Error("Invalid Location")
  }

  await writeDB(`INSERT OR IGNORE INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images (location) VALUES (?);`, [location])
  return true; // IGNORE is acceptable
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function getFloorNodes(location: string): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  if (!location || location.length > REASONABLE_MAX_STRING_SIZE) {
    logger.error(`[getFloorNodes] Invalid location: ${location}`)
    throw new Error("Invalid Location")
  }

  const nodesResult = await readDB(`SELECT n.keyframe_id, l.location, n.x_trans, n.z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON l.keyframe_id = n.keyframe_id WHERE l.location = ?;`, [location])
  return nodesResult
}

/**
 * Throws error if arguments invalid
 * @param location 
 * @returns 
 */
async function getBorderNodes(location: string): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  location = String(location).trim()
  if (location == null || location.length > REASONABLE_MAX_STRING_SIZE) {
    logger.error(`[getBorderNodes] Invalid location: ${location}`)
    throw new Error("Invalid Location")
  }

  // Step 1: Get all border nodes (nodes not in current location but connected to it)
  const borderNodesResult = await readDB(`
    SELECT DISTINCT 
      e.keyframe_id1 as keyframe_id, 
      l2.location, 
      n.x_trans, 
      n.z_trans 
    FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e 
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l 
      ON e.keyframe_id0 = l.keyframe_id 
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l2 
      ON e.keyframe_id1 = l2.keyframe_id
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n 
      ON n.keyframe_id = e.keyframe_id1
    WHERE l.location = ? AND l2.location <> ?
  `, [location, location])

  if (borderNodesResult.length === 0) {
    return []
  }

  // Step 2: Handle staircase nodes specially
  const processedNodes = await processStaircaseNodes(borderNodesResult, location)

  // Step 3: Cluster border nodes to reduce redundancy
  const clusteredNodes = await clusterBorderNodes(processedNodes)

  logger.verbose(`[getBorderNodes] Found ${borderNodesResult.length} border nodes, processed to ${clusteredNodes.length} clusters for location: ${location}`)
  return clusteredNodes
}

/**
 * Process staircase nodes by replacing them with their destination nodes
 * @param borderNodes - Array of border nodes
 * @param currentLocation - Current location being processed
 * @returns Processed border nodes with staircase nodes replaced
 */
async function processStaircaseNodes(
  borderNodes: Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>,
  currentLocation: string
): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  const processedNodes: Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }> = []
  
  for (const node of borderNodes) {
    // Check if this is a staircase node
    if (node.location.startsWith('staircase -')) {
      try {
        // Find all distinct locations that this staircase connects to
        const connectedLocations = await readDB(`
          SELECT DISTINCT l.location
          FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e
          JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l 
            ON e.keyframe_id1 = l.keyframe_id
          WHERE e.keyframe_id0 = ? AND l.location <> ? AND l.location <> ?
        `, [node.keyframe_id, currentLocation, node.location])

        // Find the first node in a non-staircase location that connects to this staircase
        for (const connectedLocation of connectedLocations) {
          if (!connectedLocation.location.endsWith('- staircase') && connectedLocation.location !== currentLocation) {
            const destinationNode = await readDB(`
              SELECT n.keyframe_id, l.location, n.x_trans, n.z_trans
              FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l 
                ON e.keyframe_id1 = l.keyframe_id
              JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n 
                ON n.keyframe_id = e.keyframe_id1
              WHERE e.keyframe_id0 = ? AND l.location = ?
              LIMIT 1
            `, [node.keyframe_id, connectedLocation.location])

            if (destinationNode.length > 0) {
              // Replace staircase node with destination node
              processedNodes.push(destinationNode[0])
              logger.verbose(`[processStaircaseNodes] Replaced staircase node ${node.keyframe_id} with destination node ${destinationNode[0].keyframe_id} in location ${destinationNode[0].location}`)
              break // Only use the first valid destination
            }
          }
        }
      } catch (error) {
        logger.warn(`[processStaircaseNodes] Error processing staircase node ${node.keyframe_id}: ${error}`)
        // Fall back to using the original node
        processedNodes.push(node)
      }
    } else {
      // Non-staircase node, keep as is
      processedNodes.push(node)
    }
  }

  return processedNodes
}

/**
 * Cluster border nodes to reduce redundancy by grouping nodes within 2 steps of each other
 * @param borderNodes - Array of border nodes to cluster
 * @returns Clustered border nodes with one representative per cluster
 */
async function clusterBorderNodes(
  borderNodes: Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>
): Promise<Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }>> {
  if (borderNodes.length === 0) {
    return []
  }

  // Create a map of node connections for efficient lookup
  const nodeConnections = new Map<number, Set<number>>()
  
  // Build connection graph for border nodes
  for (const node of borderNodes) {
    const connections = await readDB(`
      SELECT DISTINCT e.keyframe_id1 as connected_id
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e
      WHERE e.keyframe_id0 = ?
      UNION
      SELECT DISTINCT e.keyframe_id0 as connected_id
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e
      WHERE e.keyframe_id1 = ?
    `, [node.keyframe_id, node.keyframe_id])

    const connectedIds = new Set<number>(connections.map((conn: { connected_id: number }) => conn.connected_id))
    nodeConnections.set(node.keyframe_id, connectedIds)
  }

  // Find clusters using depth-first search with depth limit of 2
  const visited = new Set<number>()
  const clusters: Array<Set<number>> = []

  for (const node of borderNodes) {
    if (!visited.has(node.keyframe_id)) {
      const cluster = new Set<number>()
      findCluster(node.keyframe_id, nodeConnections, visited, cluster, 0, 2)
      if (cluster.size > 0) {
        clusters.push(cluster)
      }
    }
  }

  // Select one representative node from each cluster
  const representativeNodes: Array<{ keyframe_id: number, location: string, x_trans: number, z_trans: number }> = []
  
  for (const cluster of clusters) {
    // Find the node in this cluster that has the most connections to the original location
    // This helps select a more representative node
    let bestNode: { keyframe_id: number, location: string, x_trans: number, z_trans: number } | null = null
    let maxConnections = -1

    for (const nodeId of cluster) {
      const node = borderNodes.find(n => n.keyframe_id === nodeId)
      if (node) {
        const connections = nodeConnections.get(nodeId) || new Set()
        if (connections.size > maxConnections) {
          maxConnections = connections.size
          bestNode = node
        }
      }
    }

    if (bestNode) {
      representativeNodes.push(bestNode)
      logger.verbose(`[clusterBorderNodes] Selected representative node ${bestNode.keyframe_id} from cluster of ${cluster.size} nodes`)
    }
  }

  return representativeNodes
}

/**
 * Recursively find all nodes in a cluster within the specified depth
 * @param nodeId - Current node ID
 * @param nodeConnections - Map of node connections
 * @param visited - Set of visited nodes
 * @param cluster - Current cluster being built
 * @param currentDepth - Current depth in the search
 * @param maxDepth - Maximum depth to search
 */
function findCluster(
  nodeId: number,
  nodeConnections: Map<number, Set<number>>,
  visited: Set<number>,
  cluster: Set<number>,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth > maxDepth || visited.has(nodeId)) {
    return
  }

  visited.add(nodeId)
  cluster.add(nodeId)

  const connections = nodeConnections.get(nodeId) || new Set()
  for (const connectedId of connections) {
    findCluster(connectedId, nodeConnections, visited, cluster, currentDepth + 1, maxDepth)
  }
}