import { Request, Response } from "express";
import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE, REASONABLE_MAX_Y_DIST_THRESHOLD, REASONABLE_MAX_XZ_DIST_THRESHOLD, FLOOR_POINT_DEFAULT_TYPE } from "../consts";
import { readDB, writeDB } from "../db";
import { searchNeighbour } from "../logic/neighbourSearch";
import { aStarPathfinding } from "../logic/pathfinding";
import { BlobArrayToMatrix, convertToUICoordinateScale } from "../logic/utils";
import logger from "../logger";
import * as THREE from "three";

export async function getFirstPointId(req: Request, res: Response) {
  const firstPoint = await readDB(`SELECT keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id >= 0 LIMIT 1;`, [], true);
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
  let locationResults = await readDB(`SELECT s.keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s WHERE s.label = ? LIMIT 1;`, [locationCode], true);
  let isLabel = true;
  if (!locationResults) {
    isLabel = false
    const firstPointWithLocation = (await readDB(`SELECT n.keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations nl ON n.keyframe_id = nl.keyframe_id WHERE nl.location = ? LIMIT 1;`, [locationCode], true));
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
    `SELECT x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?`,
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

  const pointData = await readDB(`SELECT n.keyframe_id, n.ts, n.pose, l.location, n.x_trans, n.y_trans, n.z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n LEFT JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE n.keyframe_id = ?;`, [id], true);
  if (pointData && 'pose' in pointData) {
    res.json(convertToUICoordinateScale({ ...pointData, pose: BlobArrayToMatrix(pointData.pose) }))
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
  const { x_trans, y_trans, z_trans, type, label, location, description } = req.body;

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
      `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes 
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
      `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations 
       (keyframe_id, location) VALUES (?, ?)`,
      [keyframeId, location]
    );

    // 3. Insert into special_labels table if label is provided
    if (label) {
      await writeDB(
        `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels 
         (keyframe_id, label) VALUES (?, ?)`,
        [keyframeId, label]
      );
    }

    // 4. Insert into floorplan_points table
    await writeDB(
      `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points 
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
