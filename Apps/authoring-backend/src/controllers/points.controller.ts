import { Request, Response } from "express";
import { REASONABLE_MAX_STRING_SIZE, REASONABLE_MAX_Y_DIST_THRESHOLD, REASONABLE_MAX_XZ_DIST_THRESHOLD, FLOOR_POINT_DEFAULT_TYPE } from "../consts";
import { readDB, writeDB } from "../db";
import { searchNeighbour } from "../logic/neighbourSearch";
import { aStarPathfinding } from "../logic/pathfinding";
import { BlobArrayToMatrix, convertToUICoordinateScale } from "../logic/utils";
import logger from "../logger";
import * as THREE from "three";

export async function getFirstPointId(req: Request, res: Response) {
  const firstPoint = await readDB(`SELECT keyframe_id FROM nodes WHERE keyframe_id >= 0 LIMIT 1;`, [], true);
  if (firstPoint && 'keyframe_id' in firstPoint) {
    res.json(firstPoint.keyframe_id)
  }
  else {
    logger.warn(`[getFirstPointId] Failed to get first point`)
    res.status(500).send("Failed to get first point - No points exist, or internal server error").end()
  }
}

export async function pathfindFromPointId(req: Request, res: Response) {
  const point = Number(req.params.id)
  const locationCode = String(req.params.location)
  if (isNaN(point) || !locationCode || locationCode == "" || locationCode.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[PathfindFromPointId] had invalid arguments:${point} location: ${locationCode}`)
    res.status(400).send("Invalid Arguments").end()
    return
  }

  // Check label first, as these are manually annotated (and supposedly special) points
  let locationResults = await readDB(`SELECT otn.ref_id as keyframe_id FROM other_nodes otn WHERE otn.label = ? LIMIT 1;`, [locationCode], true);
  let isLabel = true;
  if (!locationResults) {
    isLabel = false
    const firstPointWithLocation = (await readDB(`SELECT n.keyframe_id FROM nodes n JOIN node_locations nl ON n.keyframe_id = nl.keyframe_id WHERE nl.location = ? LIMIT 1;`, [locationCode], true));
    if (firstPointWithLocation.length === 0) {
      logger.warn(`[PathfindFromPointId] Failed to find endpoint for a location, for start: ${point} and end location: ${locationCode}`)
      res.status(400).send("End location could not be found");
      return
    }
    locationResults = firstPointWithLocation
  }

  if ('keyframe_id' in locationResults) {
    res.json({ path: await aStarPathfinding(point, locationResults.keyframe_id, isLabel ? null : locationCode) ?? [] })
  }
  else {
    logger.warn(`[PathfindFromPointId] A* failed to find endpoint: ${locationResults.keyframe_id} for start: ${point} and end location: ${locationCode}`)
    res.status(400).send("End location could not be found");
  }
}

export async function findNeigboursFromPointId(req: Request, res: Response) {

  const mainPointId = Number(req.params.id)
  const distanceThreshold = Number(req.params.distance_thresh_m);
  const yDistThresh = Number(req.params.y_dist_thresh_m);
  if (isNaN(Number(mainPointId)) || isNaN(Number(distanceThreshold)) || isNaN(Number(yDistThresh)) || yDistThresh > REASONABLE_MAX_Y_DIST_THRESHOLD || distanceThreshold > REASONABLE_MAX_XZ_DIST_THRESHOLD) {
    logger.warn(`[findNeighbourFromPointId] Invalid params - point: ${mainPointId} with dist threshold: ${distanceThreshold} and y threshold: ${yDistThresh}`)
    res.status(400).send("Invalid params").end();
    return;
  }

  // Fetch the initial point
  const currentPoint = await readDB(
    `SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = ?`,
    [mainPointId], true
  );
  if (!currentPoint) {
    logger.warn(`[findNeighbourFromPointId] Point id doesn't exist: ${mainPointId} with dist threshold: ${distanceThreshold} and y threshold: ${yDistThresh}`)
    res.status(400).send("Point ID given does not exist!").end()
    return
  }

  res.json(await searchNeighbour(mainPointId, distanceThreshold, yDistThresh, currentPoint))
}

export async function getPointInfoFromId(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (isNaN(id)) {
    logger.warn(`[getPointInfoFromId] invalid ID:${id}`)
    res.status(400).send("Non-number point ID passed").end()
    return
  }

  const pointData = await readDB(
    `SELECT n.keyframe_id, n.ts, n.pose, l.location, n.x_trans, n.y_trans, n.z_trans 
     FROM nodes n 
     LEFT JOIN node_locations l 
     ON n.keyframe_id = l.keyframe_id 
     WHERE n.keyframe_id = ?;`, 
    [id], true
  );

  // Fetch associated labels
  const labelRows = await readDB(
    `SELECT label, description, info, image, type FROM other_nodes WHERE ref_id = ?;`,
    [id]
  );
  const labels = Array.isArray(labelRows) ? labelRows.map((row: any) => ({
    label: row.label,
    description: row.description,
    info: row.info,
    image: row.image,
    type: row.type
  })) : [];

  if (pointData && 'pose' in pointData) {
    res.json({
      ...convertToUICoordinateScale({ ...pointData, pose: BlobArrayToMatrix(pointData.pose) }),
      labels
    });
  }
  else {
    logger.warn(`[getPointInfoFromId] id doesn't exist, or pose not in pointData: ${id} data: ${pointData}`)
    res.status(400).send("Point ID given does not exist!").end()
  }
}

/**
 * Create a new point with the given position, type, and label
 */
export async function createNewPoint(req: Request, res: Response) {
  const { x_trans, y_trans, z_trans, type, label, location, description, info, image } = req.body;

  // Validate input
  if (isNaN(Number(x_trans)) || isNaN(Number(y_trans)) || isNaN(Number(z_trans)) ||
    isNaN(Number(type)) || !location || location.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[createNewPoint] Invalid arguments: x_trans=${x_trans}, y_trans=${y_trans}, z_trans=${z_trans}, type=${type}, location=${location}`);
    res.status(400).send("Invalid Arguments").end();
    return;
  }

  try {
    await writeDB("BEGIN;");

    // Create a default identity pose matrix
    const identityMatrix = new THREE.Matrix4().identity();
    const matrixArray = new Float64Array(16);
    identityMatrix.toArray(matrixArray);

    // Create a buffer from the matrix array
    const poseBuffer = Buffer.from(matrixArray.buffer);

    // 1. Insert into nodes table
    const timestamp = Date.now();
    const result = await writeDB(
      `INSERT INTO nodes 
       (ts, pose, x_trans, y_trans, z_trans, zone) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [timestamp, poseBuffer, x_trans, y_trans, z_trans, null]
    );

    // Get the last inserted ID
    const lastIdResult = await readDB(
      `SELECT last_insert_rowid() as id`,
      [],
      true
    );

    if (!lastIdResult || !('id' in lastIdResult)) {
      throw new Error("Failed to get last inserted ID");
    }

    const keyframeId = lastIdResult.id;

    // 2. Insert into node_locations table
    await writeDB(
      `INSERT INTO node_locations 
       (keyframe_id, location) VALUES (?, ?)`,
      [keyframeId, location]
    );

    // 3. Insert into other_nodes table if label is provided
    if (label) {
      await writeDB(
        `INSERT INTO other_nodes 
         (ref_id, label, description, info, image, type, x_trans, y_trans, z_trans) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [keyframeId, label, description || label, info || '', image || '', 0, 0, 0, 0]
      );
    }

    // 4. Insert into floorplan_points table
    await writeDB(
      `INSERT INTO floorplan_points 
       (location, x, y, keyframe_id, type) VALUES (?, ?, ?, ?, ?)`,
      [location, 0.5, 0.5, keyframeId, type || FLOOR_POINT_DEFAULT_TYPE]
    );

    await writeDB("COMMIT;");

    res.status(201).json({
      keyframe_id: keyframeId,
      message: "Point created successfully"
    });
  } catch (error) {
    await writeDB("ROLLBACK;");
    logger.error(`[createNewPoint] Error creating point: ${error}`);
    res.status(500).json({ message: "Error creating point" });
  }
}

export async function getRandomPointId(req: Request, res: Response) {
  try {
    const result = await readDB(
      `SELECT keyframe_id FROM nodes WHERE keyframe_id >= 0 ORDER BY RANDOM() LIMIT 1;`,
      [],
      true
    );
    if (result && 'keyframe_id' in result) {
      res.json({ keyframe_id: result.keyframe_id });
    } else {
      res.status(404).json({ message: "No points found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching random point" });
  }
}

/**
 * Get nearby points within a distance threshold for clustering analysis
 */
export async function getNearbyPoints(req: Request, res: Response) {
  const { id } = req.params;
  const { distance_threshold = 5.0, location } = req.query; // Default 5 meters

  try {
    const pointId = Number(id);
    if (isNaN(pointId)) {
      return res.status(400).json({ message: 'Invalid point ID' });
    }

    // Get the reference point
    const referencePoint = await readDB(
      `SELECT keyframe_id, x_trans, y_trans, z_trans 
       FROM nodes 
       WHERE keyframe_id = ?`,
      [pointId],
      true
    );

    if (!referencePoint) {
      return res.status(404).json({ message: 'Reference point not found' });
    }

    // Build location filter
    let locationFilter = '';
    let locationParams: any[] = [];
    if (location) {
      locationFilter = `
        AND EXISTS (
          SELECT 1 FROM node_locations nl 
          WHERE nl.keyframe_id = n.keyframe_id AND nl.location = ?
        )
      `;
      locationParams = [location];
    }

    // Find nearby points
    const nearbyPointsQuery = `
      SELECT n.keyframe_id, n.x_trans, n.y_trans, n.z_trans, n.ts,
             fp.x, fp.y, fp.type,
             SQRT(
               POWER(n.x_trans - ?, 2) + 
               POWER(n.y_trans - ?, 2) + 
               POWER(n.z_trans - ?, 2)
             ) as distance
      FROM nodes n
      LEFT JOIN floorplan_points fp 
        ON n.keyframe_id = fp.keyframe_id
      WHERE n.keyframe_id != ? 
        AND SQRT(
          POWER(n.x_trans - ?, 2) + 
          POWER(n.y_trans - ?, 2) + 
          POWER(n.z_trans - ?, 2)
        ) <= ?
        ${locationFilter}
      ORDER BY distance
    `;

    const nearbyPoints = await readDB(nearbyPointsQuery, [
      referencePoint.x_trans, referencePoint.y_trans, referencePoint.z_trans,
      pointId,
      referencePoint.x_trans, referencePoint.y_trans, referencePoint.z_trans,
      Number(distance_threshold),
      ...locationParams
    ]);

    res.status(200).json({
      reference_point: referencePoint,
      nearby_points: nearbyPoints,
      count: nearbyPoints.length,
      distance_threshold: Number(distance_threshold)
    });
  } catch (error) {
    logger.error('Error fetching nearby points:', error);
    res.status(500).json({ message: 'Error fetching nearby points' });
  }
}

/**
 * Get clustering statistics for a location
 */
export async function getClusteringStats(req: Request, res: Response) {
  const { location } = req.params;
  const { distance_threshold = 2.0 } = req.query;

  try {
    // Get all points for this location
    const pointsQuery = `
      SELECT n.keyframe_id, n.x_trans, n.y_trans, n.z_trans, fp.type
      FROM nodes n
      JOIN node_locations nl ON n.keyframe_id = nl.keyframe_id
      LEFT JOIN floorplan_points fp ON n.keyframe_id = fp.keyframe_id
      WHERE nl.location = ?
      ORDER BY n.keyframe_id
    `;
    
    const points = await readDB(pointsQuery, [location]);

    // Simple clustering analysis
    const clusters: Array<{
      center: { x: number; y: number; z: number };
      points: Array<{ keyframe_id: number; type: number; distance: number }>;
      size: number;
    }> = [];

    for (const point of points) {
      let addedToCluster = false;
      
      for (const cluster of clusters) {
        const distance = Math.sqrt(
          Math.pow(point.x_trans - cluster.center.x, 2) +
          Math.pow(point.y_trans - cluster.center.y, 2) +
          Math.pow(point.z_trans - cluster.center.z, 2)
        );
        
        if (distance <= Number(distance_threshold)) {
          cluster.points.push({
            keyframe_id: point.keyframe_id,
            type: point.type || 0,
            distance: distance
          });
          cluster.size = cluster.points.length;
          addedToCluster = true;
          break;
        }
      }
      
      if (!addedToCluster) {
        clusters.push({
          center: { x: point.x_trans, y: point.y_trans, z: point.z_trans },
          points: [{
            keyframe_id: point.keyframe_id,
            type: point.type || 0,
            distance: 0
          }],
          size: 1
        });
      }
    }

    // Calculate statistics
    const totalPoints = points.length;
    const totalClusters = clusters.length;
    const avgClusterSize = totalClusters > 0 ? totalPoints / totalClusters : 0;
    const maxClusterSize = Math.max(...clusters.map(c => c.size), 0);

    res.status(200).json({
      location,
      total_points: totalPoints,
      total_clusters: totalClusters,
      average_cluster_size: avgClusterSize,
      max_cluster_size: maxClusterSize,
      clusters: clusters
    });
  } catch (error) {
    logger.error('Error calculating clustering stats:', error);
    res.status(500).json({ message: 'Error calculating clustering statistics' });
  }
}

/**
 * Get image for a specific point
 */
export async function getPointImage(req: Request, res: Response) {
  const pointId = Number(req.params.id);
  
  if (isNaN(pointId)) {
    logger.warn(`[getPointImage] Invalid point ID: ${pointId}`);
    res.status(400).json({ message: 'Invalid point ID' });
    return;
  }

  try {
    // Get the timestamp for this point
    const pointResult = await readDB(
      `SELECT ts FROM nodes WHERE keyframe_id = ?`,
      [pointId],
      true
    );

    if (!pointResult) {
      res.status(404).json({ message: 'Point not found' });
      return;
    }

    // Try to find an image with this timestamp
    // This is a simplified implementation - you might need to adjust based on your image storage
    const imagePath = `/path/to/images/${pointResult.ts}.jpg`; // Adjust based on your image storage
    
    // For now, return a placeholder or error
    res.status(404).json({ message: 'Image not available for this point' });
  } catch (error) {
    logger.error(`[getPointImage] Error: ${error}`);
    res.status(500).json({ message: 'Error fetching point image' });
  }
}

/**
 * Get labels for a specific point
 */
export async function getPointLabels(req: Request, res: Response) {
  const pointId = Number(req.params.id);
  
  if (isNaN(pointId)) {
    logger.warn(`[getPointLabels] Invalid point ID: ${pointId}`);
    res.status(400).json({ message: 'Invalid point ID' });
    return;
  }

  try {
    const otherNodes = await readDB(
      `SELECT id, ref_id, label, description, type, x_trans, y_trans, z_trans 
       FROM other_nodes 
       WHERE ref_id = ? 
       ORDER BY type, label`,
      [pointId]
    );

    res.status(200).json({
      otherNodes: otherNodes
    });
  } catch (error) {
    logger.error(`[getPointLabels] Error: ${error}`);
    res.status(500).json({ message: 'Error fetching point labels' });
  }
}

/**
 * Add a label to a specific point
 */
export async function addPointLabel(req: Request, res: Response) {
  const pointId = Number(req.params.id);
  const { 
    label, 
    type = 0, 
    description = '', 
    info = '',
    image = '',
    x_offset = 0, 
    y_offset = 0.05, 
    z_offset = 0 
  } = req.body;

  if (isNaN(pointId)) {
    logger.warn(`[addPointLabel] Invalid point ID: ${pointId}`);
    res.status(400).json({ message: 'Invalid point ID' });
    return;
  }

  try {
    // Get node coordinates for positioning
    const nodeResult = await readDB(
      `SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = ?`,
      [pointId],
      true
    );
    
    if (!nodeResult) {
      res.status(404).json({ message: 'Node not found' });
      return;
    }

    // Calculate position (5% higher than original node by default)
    const finalX = nodeResult.x_trans + x_offset;
    const finalY = nodeResult.y_trans * 1.05 + y_offset;
    const finalZ = nodeResult.z_trans + z_offset;

    // Check if label already exists
    const existingLabel = await readDB(
      `SELECT id FROM other_nodes 
       WHERE ref_id = ? AND label = ?`,
      [pointId, label],
      true
    );
    
    if (existingLabel) {
      res.status(409).json({ 
        message: 'Label already exists for this node',
        existing_id: existingLabel.id 
      });
      return;
    }
    
    // Insert into other_nodes table
    await writeDB(
      `INSERT INTO other_nodes 
       (ref_id, label, description, info, image, type, x_trans, y_trans, z_trans) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pointId, label, description, info, image, type, finalX, finalY, finalZ]
    );
    
    res.status(201).json({ 
      message: 'Label added successfully',
      point_id: pointId,
      label: label
    });
  } catch (error) {
    logger.error(`[addPointLabel] Error: ${error}`);
    res.status(500).json({ message: 'Error adding label' });
  }
}

/**
 * Update a label for a specific point
 */
export async function updatePointLabel(req: Request, res: Response) {
  const pointId = Number(req.params.id);
  const { old_label, new_label, type = 0, description = '', info = '', image = '' } = req.body;

  if (isNaN(pointId)) {
    logger.warn(`[updatePointLabel] Invalid point ID: ${pointId}`);
    res.status(400).json({ message: 'Invalid point ID' });
    return;
  }

  try {
    await writeDB(
      `UPDATE other_nodes 
       SET label = ?, description = ?, info = ?, image = ?, type = ? 
       WHERE ref_id = ? AND label = ?`,
      [new_label, description, info, image, type, pointId, old_label]
    );
    
    res.status(200).json({ 
      message: 'Label updated successfully',
      point_id: pointId,
      old_label: old_label,
      new_label: new_label
    });
  } catch (error) {
    logger.error(`[updatePointLabel] Error: ${error}`);
    res.status(500).json({ message: 'Error updating label' });
  }
}

/**
 * Delete an other_node entry
 */
export async function deleteOtherNode(req: Request, res: Response) {
  const otherNodeId = Number(req.params.id);

  if (isNaN(otherNodeId)) {
    logger.warn(`[deleteOtherNode] Invalid other node ID: ${otherNodeId}`);
    res.status(400).json({ message: 'Invalid other node ID' });
    return;
  }

  try {
    const result = await writeDB(
      `DELETE FROM other_nodes WHERE id = ?`,
      [otherNodeId]
    );
    
    if (result > 0) {
      res.status(200).json({ 
        message: 'Other node deleted successfully',
        deleted_id: otherNodeId
      });
    } else {
      res.status(404).json({ message: 'Other node not found' });
    }
  } catch (error) {
    logger.error(`[deleteOtherNode] Error: ${error}`);
    res.status(500).json({ message: 'Error deleting other node' });
  }
}
