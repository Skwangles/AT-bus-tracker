import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE, RESERVED_START_OF_LABELS } from "../consts"
import { readDB } from "../db"
import { Request, Response } from "express"


export async function getAllSearchableLabels(req: Request, res: Response) {
  res.json((await readDB(`SELECT DISTINCT l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l UNION SELECT DISTINCT label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s WHERE s.label is not NULL AND s.label <> '';`)))
}

export async function getPointWithLocationGroupOrLabelName(req: Request, res: Response) {
  const name = String(req.params.floor).trim()

  if (!name || name == "" || name.length > REASONABLE_MAX_STRING_SIZE) {
    res.status(400).send("Invalid Arguments").end()
    return
  }

  const containsReservedString = RESERVED_START_OF_LABELS.some((val: string) => name.startsWith(val))
  if (containsReservedString) {
    res.status(400).send("Invalid Arguments").end()
  }

  // Get FIRST node which has that location
  const nodeWithSpecialLabel = await readDB(`SELECT n.keyframe_id, pose, x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ?`, [name])

  if (nodeWithSpecialLabel.length != 0) {
    console.log("Found a label", nodeWithSpecialLabel)
    res.json(nodeWithSpecialLabel[0])
    return;
  }

  const firstNodeWithLocation = await readDB(`SELECT n.keyframe_id, l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = ? LIMIT 1`, [name])
  if (firstNodeWithLocation.length > 0) {
    console.log("Returning rows")
    res.json(firstNodeWithLocation[0])
  }
  else {
    console.log("Could not find")
    res.status(404).send("Could not find any nodes with that location").end();
  }
}