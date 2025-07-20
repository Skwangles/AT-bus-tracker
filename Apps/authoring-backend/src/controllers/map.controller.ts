import path from "node:path";
import fs from 'fs'
import { USE_TABLE_PREFIX, TABLE_PREFIX, FLOORPLAN_IMG_DIR, REASONABLE_MAX_STRING_SIZE } from "../consts";
import { readDB, writeDB } from "../db";
import { Request, Response } from "express";
import logger from "../logger";

export async function getMapPoints(req: Request, res: Response) {
  const name = String(req.params.name).trim();
  if (name == null || name == "") {
    logger.warn(`[GetMapPoints] Invalid name: ${name}`)
    res.status(400).send("Invalid Arguments")
    return
  }

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const points = await readDB(`
    SELECT 
      f.keyframe_id, 
      f.x, 
      f.y, 
      f.type,
      COALESCE(label_counts.label_count, 0) as labelCount
    FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points f 
    LEFT JOIN (
      SELECT 
        ref_id as keyframe_id,
        COUNT(*) as label_count
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      GROUP BY ref_id
    ) label_counts ON f.keyframe_id = label_counts.keyframe_id
    WHERE f.location = ?
  `, [name]);
  const image = await readDB(`SELECT path FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images WHERE location = ? LIMIT 1;`, [name])

  const edges = await readDB(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points f ON e.keyframe_id0 = f.keyframe_id JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points f2 ON e.keyframe_id1 = f2.keyframe_id WHERE f.location = ? AND f2.location = ?`, [name, name])
  if (points.length && points.length > 0 && image.length && image.length > 0) {
    res.json({ nodes: points, has_image: image[0].path != '', image: image[0].path, edges: edges })
  } else {
    logger.warn(`[GetMapPoints] Floorplan not found with name: ${name}`)
    res.status(404).send('Floorplan not found');
  }
}

export async function getAllLocationGroups(req: Request, res: Response) {
  const floorplanResults = await readDB(`SELECT DISTINCT location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images;`)
  res.json(floorplanResults.map((val: { location: string }) => val.location));
}

export async function getLocationGroupImageByName(req: Request, res: Response) {
  const requestId = Math.random().toString(36).substring(2, 15)
  const name = String(req.params.name);

  logger.info(`[getLocationGroupImageByName:${requestId}] Image request received`, {
    location: name,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    timestamp: new Date().toISOString()
  })

  if (name == null || name == "" || name.length > REASONABLE_MAX_STRING_SIZE) {
    logger.error(`[getLocationGroupImageByName:${requestId}] Invalid name passed`, {
      location: name,
      nameLength: name?.length,
      maxLength: REASONABLE_MAX_STRING_SIZE,
      error: 'Invalid location name'
    })
    res.status(400).send("Invalid Arguments")
    return
  }

  const result = await readDB(`SELECT path FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images WHERE location = ? LIMIT 1;`, [name], true)
  if (!result) {
    logger.warn(`[GetLocGroupImgByName] Could not find path from location name: ${name}`)
    res.sendStatus(404).send("Invalid uments");
    return;
  }

  const pathString = path.join(FLOORPLAN_IMG_DIR, String(result.path));

  // Check the path is valid and isn't a directory traversal attempt
  if (!pathString && path.dirname(pathString) == FLOORPLAN_IMG_DIR && path.basename(pathString) != "") {
    logger.warn(`[GetLocGroupImgByName] Invalid path string: ${pathString} for name: ${name}`)
    res.status(404).send("Invalid Arguments")
    return
  }
  else if (fs.existsSync(pathString) && fs.statSync(pathString).isFile()) {

    res.sendFile(pathString)
    return
  }
  else {
    logger.warn(`[GetLocGroupImgByName] File does not exist: ${pathString} for name: ${name}`)
    res.status(404).send("Invalid Arguments");
  }
}

// Controller to hide a point from the map (remove from floorplan_points but keep in nodes)
export const hideMapPoint = async (req: Request, res: Response) => {
  const { location } = req.params;
  const { keyframe_id } = req.body;

  try {
    // Check if the point exists in floorplan_points
    const existingPoint = await readDB(
      `SELECT keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
       WHERE location = ? AND keyframe_id = ?`,
      [location, keyframe_id],
      true
    );

    if (!existingPoint) {
      return res.status(404).json({ message: 'Point not found on this map' });
    }

    // Remove from floorplan_points (hides from map but keeps in nodes table)
    const deleteQuery = `
      DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
      WHERE location = ? AND keyframe_id = ?
    `;
    await writeDB(deleteQuery, [location, keyframe_id]);

    res.status(200).json({ 
      message: 'Point hidden from map successfully',
      keyframe_id: keyframe_id,
      location: location
    });
  } catch (error) {
    logger.error('Error hiding map point:', error);
    res.status(500).json({ message: 'Error hiding map point' });
  }
};

// Controller to show a point on the map (add back to floorplan_points)
export const showMapPoint = async (req: Request, res: Response) => {
  const { location } = req.params;
  const { keyframe_id, x = 0.5, y = 0.5, type = 0 } = req.body;

  try {
    // Check if the point exists in nodes table
    const nodeExists = await readDB(
      `SELECT keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes 
       WHERE keyframe_id = ?`,
      [keyframe_id],
      true
    );

    if (!nodeExists) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Check if point is already on the map
    const existingPoint = await readDB(
      `SELECT keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
       WHERE location = ? AND keyframe_id = ?`,
      [location, keyframe_id],
      true
    );

    if (existingPoint) {
      return res.status(409).json({ message: 'Point is already visible on this map' });
    }

    // Add back to floorplan_points
    const insertQuery = `
      INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
      (location, keyframe_id, x, y, type) VALUES (?, ?, ?, ?, ?)
    `;
    await writeDB(insertQuery, [location, keyframe_id, x, y, type]);

    res.status(201).json({ 
      message: 'Point shown on map successfully',
      keyframe_id: keyframe_id,
      location: location,
      position: { x, y },
      type: type
    });
  } catch (error) {
    logger.error('Error showing map point:', error);
    res.status(500).json({ message: 'Error showing map point' });
  }
};

// Controller to get hidden points for a location
export const getHiddenPoints = async (req: Request, res: Response) => {
  const { location } = req.params;

  try {
    // Get all nodes that exist but are not in floorplan_points for this location
    const hiddenPointsQuery = `
      SELECT n.keyframe_id, n.x_trans, n.y_trans, n.z_trans, n.ts
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n
      LEFT JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points fp 
        ON n.keyframe_id = fp.keyframe_id AND fp.location = ?
      LEFT JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations nl 
        ON n.keyframe_id = nl.keyframe_id AND nl.location = ?
      WHERE fp.keyframe_id IS NULL 
        AND nl.keyframe_id IS NOT NULL
      ORDER BY n.keyframe_id
    `;
    
    const hiddenPoints = await readDB(hiddenPointsQuery, [location, location]);

    res.status(200).json({
      hidden_points: hiddenPoints,
      count: hiddenPoints.length
    });
  } catch (error) {
    logger.error('Error fetching hidden points:', error);
    res.status(500).json({ message: 'Error fetching hidden points' });
  }
};

// Controller to cluster nearby points and suggest which ones to hide
export const getClusteringSuggestions = async (req: Request, res: Response) => {
  const { location } = req.params;
  const { distance_threshold = 2.0 } = req.query; // Default 2 meters

  try {
    // Get all visible points for this location
    const visiblePointsQuery = `
      SELECT fp.keyframe_id, fp.x, fp.y, fp.type, n.x_trans, n.y_trans, n.z_trans
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points fp
      JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON fp.keyframe_id = n.keyframe_id
      WHERE fp.location = ?
      ORDER BY fp.keyframe_id
    `;
    
    const visiblePoints = await readDB(visiblePointsQuery, [location]);

    // Simple clustering algorithm: group points within distance threshold
    const clusters: Array<{
      center: { x: number; y: number; z: number };
      points: Array<{ keyframe_id: number; x: number; y: number; type: number; distance: number }>;
      suggestions: Array<number>; // keyframe_ids to hide
    }> = [];

    for (const point of visiblePoints) {
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
            x: point.x,
            y: point.y,
            type: point.type,
            distance: distance
          });
          addedToCluster = true;
          break;
        }
      }
      
      if (!addedToCluster) {
        clusters.push({
          center: { x: point.x_trans, y: point.y_trans, z: point.z_trans },
          points: [{
            keyframe_id: point.keyframe_id,
            x: point.x,
            y: point.y,
            type: point.type,
            distance: 0
          }],
          suggestions: []
        });
      }
    }

    // Generate suggestions for each cluster
    for (const cluster of clusters) {
      if (cluster.points.length > 1) {
        // Sort points by type (keep special types like elevators, toilets) and distance
        cluster.points.sort((a, b) => {
          // Prioritize keeping special types (elevators, toilets, etc.)
          if (a.type !== b.type) {
            if (a.type === 1 || a.type === 2) return -1; // Keep elevators and toilets
            if (b.type === 1 || b.type === 2) return 1;
          }
          // Then by distance from center
          return a.distance - b.distance;
        });
        
        // Suggest hiding all but the first point (closest to center or most important type)
        cluster.suggestions = cluster.points.slice(1).map(p => p.keyframe_id);
      }
    }

    res.status(200).json({
      clusters: clusters,
      total_clusters: clusters.length,
      total_suggestions: clusters.reduce((sum, cluster) => sum + cluster.suggestions.length, 0)
    });
  } catch (error) {
    logger.error('Error generating clustering suggestions:', error);
    res.status(500).json({ message: 'Error generating clustering suggestions' });
  }
};

// Controller to apply clustering suggestions (hide suggested points)
export const applyClusteringSuggestions = async (req: Request, res: Response) => {
  const { location } = req.params;
  const { keyframe_ids } = req.body;

  try {
    if (!Array.isArray(keyframe_ids) || keyframe_ids.length === 0) {
      return res.status(400).json({ message: 'No keyframe IDs provided' });
    }

    // Hide all suggested points
    const deleteQuery = `
      DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
      WHERE location = ? AND keyframe_id IN (${keyframe_ids.map(() => '?').join(',')})
    `;
    
    const result = await writeDB(deleteQuery, [location, ...keyframe_ids]);

    res.status(200).json({
      message: 'Clustering suggestions applied successfully',
      hidden_points: keyframe_ids,
      count: result
    });
  } catch (error) {
    logger.error('Error applying clustering suggestions:', error);
    res.status(500).json({ message: 'Error applying clustering suggestions' });
  }
};