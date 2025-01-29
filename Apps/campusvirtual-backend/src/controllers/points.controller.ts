import { Request, Response } from "express";
import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE } from "../consts";
import { readDB } from "../db";
import { searchNeighbour } from "../logic/neighbourSearch";
import { aStarPathfinding } from "../logic/pathfinding";
import { BlobArrayToMatrix } from "../logic/utils";

export async function pathfindFromPointId(req: Request, res: Response) {
  const point = Number(req.params.id)
  const locationCode = String(req.params.location)
  if (isNaN(point) || !locationCode || locationCode == "" || locationCode.length > REASONABLE_MAX_STRING_SIZE) {
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
      res.status(400).send("End location could not be found");
      return
    }
    locationResults = firstPointWithLocation
  }

  if ('keyframe_id' in locationResults) {
    res.json({ path: await aStarPathfinding(point, locationResults.keyframe_id, isLabel ? null : locationCode) ?? [] })
  }
  else {
    res.status(400).send("End location could not be found");
  }
}

export async function findNeigboursFromPointId(req: Request, res: Response) {

  const mainPointId = Number(req.params.id)
  const distanceThreshold = Number(req.params.distance_thresh_m);
  const yDistThresh = Number(req.params.y_dist_thresh_m);
  if (isNaN(Number(mainPointId)) || isNaN(Number(distanceThreshold)) || isNaN(Number(yDistThresh))) {
    res.status(400).send("Invalid params").end();
    return;
  }

  // Fetch the initial point
  const currentPoint = await readDB(
    `SELECT x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?`,
    [mainPointId], true
  );
  if (!currentPoint) {
    res.status(400).send("Point ID given does not exist!").end()
    return
  }

  res.json(await searchNeighbour(mainPointId, distanceThreshold, yDistThresh, currentPoint))
}

export async function getPointInfoFromId(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!id || isNaN(id)) {
    res.status(400).send("Non-number point ID passed").end()
    return
  }

  const pointData = await readDB(`SELECT n.keyframe_id, n.ts, n.pose, l.location, n.x_trans, n.y_trans, n.z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n LEFT JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE n.keyframe_id = ?;`, [id], true);
  console.log("Point Data: ", pointData)
  if (pointData && 'pose' in pointData) {
    console.log("Point: ", pointData);
    res.json({ ...pointData, pose: BlobArrayToMatrix(pointData.pose) })
  }
  else {
    res.status(400).send("Point ID given does not exist!").end()
  }
}