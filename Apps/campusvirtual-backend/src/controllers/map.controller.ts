import { USE_TABLE_PREFIX, TABLE_PREFIX } from "../consts";
import { readDB } from "../db";
import { Request, Response } from "express";

export async function getMapPoints(req: Request, res: Response) {
  const name = req.params.name;
  if (!name) {
    res.status(400).send("Invalid Arguments")
    return
  }

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const pointResult = await readDB(`SELECT f.keyframe_id, x, y, type FROM floorplan_points f JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON n.keyframe_id = f.keyframe_id WHERE location = ?`, [name]);
  const image = await readDB("SELECT path FROM floorplan_images WHERE location = ? LIMIT 1;", [name])

  const edges = await readDB(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}edges e JOIN floorplan_points f ON e.keyframe_id0 = f.keyframe_id JOIN floorplan_points f2 ON e.keyframe_id1 = f2.keyframe_id WHERE f.location = ? AND f2.location = ?`, [name, name])
  if (pointResult.length && pointResult.length > 0 && image.length && image.length > 0) {
    res.json({ nodes: pointResult, has_image: image[0].path != '', image: image[0].path, edges: edges })
  } else {
    res.status(404).send('Floorplan not found');
  }
}

export async function getAllLocationGroups(req: Request, res: Response) {
  const floorplanResults = await readDB("SELECT DISTINCT location FROM floorplan_images;")
  res.json(floorplanResults.map((val: { location: string }) => val.location));
}