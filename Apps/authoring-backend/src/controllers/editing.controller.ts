import { Request, Response } from "express";
import logger from "../logger";
import { REASONABLE_MAX_STRING_SIZE, USE_TABLE_PREFIX, TABLE_PREFIX } from "../consts";
import { writeDB, readDB } from "../db";
import { replaceNode, connectNodes, disconnectNodes } from "../logic/utils";


export async function updateMultipleMapPoints(req: Request, res: Response) {
  const { name } = req.params;
  const { points } = req.body;
  for (const point of points) {
    await writeDB(
      "UPDATE floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;",
      [point.x, point.y, point.id, name]
    )
      .then((changes: number) => {
        if (changes == 0) {
          res.status(404).send("Could not find point to update");
          return;
        }
      })
      .catch(() => {
        res.status(404).send("Error updating point");
        return;
      });
  }
  res.sendStatus(200);
}

export async function updateMapPoint(req: Request, res: Response) {
  const { name } = req.params;
  const { id, x, y } = req.body;

  await writeDB(
    "UPDATE floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;",
    [x, y, id, name]
  )
    .then((changes: number) => {
      if (changes > 0) {
        res.sendStatus(200);
      } else {
        res.status(404).send("Could not find point to update");
      }
    })
    .catch(() => {
      res.status(404).send("Error updating point");
    });
}

export async function addLabelToMapPoint(req: Request, res: Response) {
  let label = String(req.body.label).trim();
  const id = Number(req.params.id);
  if (isNaN(id) || !label || label.length > REASONABLE_MAX_STRING_SIZE) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }

  label = label.replace("<", "\<").replace(">", "\>"); // THIS AREA MAY BE VULNERABLE TO XSS - Only if the attacker gets ahold of the authoring panel, please disable it in consts once you are done authoring
  const changes = await writeDB(
    `INSERT OR IGNORE INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }special_labels (keyframe_id, label) VALUES (?, ?) WHERE 
    EXISTS (SELECT keyframe_id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?)`,
    [id, label, id]
  );
  res
    .status(changes > 0 ? 200 : 409)
    .send(
      changes > 0
        ? "Point labelled"
        : "Error occurred - The point may be a border point, which cannot be deleted"
    );
}

export async function deleteLabel(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }
  const result = await replaceNode(Number(id));
  res
    .status(result ? 200 : 409)
    .send(
      result
        ? "Point deleted"
        : "Error occurred - The point may be a border point, which cannot be deleted"
    );
}


export async function connectTwoPoints(req: Request, res: Response) {
  const id1 = Number(req.params.id1);
  const id2 = Number(req.params.id2);

  if (isNaN(id1) || isNaN(id2)) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }

  const is_on_same_level = await readDB(
    "SELECT kf1.keyframe_id, kf2.keyframe_id, kf1.location FROM floorplan_points kf1 JOIN floorplan_points kf2 ON kf1.location = kf2.location AND kf1.keyframe_id <> kf2.keyframe_id AND kf1.keyframe_id = ? AND kf2.keyframe_id = ? LIMIT 1;",
    [id1, id2]
  );
  if (is_on_same_level.length == 0) {
    res.status(409).send("Points are not on the same level!");
    return;
  }

  const result = await connectNodes(Number(id1), Number(id2));
  res
    .status(result ? 201 : 409)
    .send(
      result
        ? "Points connected"
        : "Error occurred - The points may already be connected, or are border points!"
    );
}



export async function disconnectTwoPoints(req: Request, res: Response) {
  const { id1, id2 } = req.params;

  const is_edge = await readDB(
    `SELECT * FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?) LIMIT 1;`,
    [id1, id2, id2, id1]
  );
  if (is_edge.length == 0) {
    res.status(409).send("Points are not connected!");
    return;
  }

  const result = await disconnectNodes(Number(id1), Number(id2));
  res
    .status(result ? 201 : 409)
    .send(
      result
        ? "Points connected"
        : "Error occurred - The points may already be disconnected, or are border points!"
    );
}

export async function updateFloorplanImage(req: Request, res: Response) {
  try {
    const { name } = req.params;
    const file = req.file;
    if (!file) {
      logger.error(`[updateFloorplanImage] no image provided for name: ${name}`)
      res.status(400).send("No file uploaded.");
      return
    }

    // Save the image path to the database
    const filePath = file.filename;
    await writeDB(
      "UPDATE floorplan_images SET path = ? WHERE location = ?",
      [filePath, name]
    );

    res.send("File uploaded and path updated successfully.");
  } catch (error) {
    logger.error(`[updateFloorplanImage] Error handling file upload: ${error}`);
    res.status(500).send("Could not upload image");
  }
}