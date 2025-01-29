import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE, RESERVED_START_OF_LABELS } from "../consts"
import { readDB } from "../db"
import { Request, Response } from "express"
import { convertToUICoordinateScale } from "../logic/utils"

interface Label {
  query: string, // query to search the database
  label: string, // the actual label to be used
  group?: string // the shared location with potentially other labels with the same location
}

export async function getAllSearchableLabels(req: Request, res: Response) {

  const locations = await readDB(`SELECT DISTINCT l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l;`)
  const parsed_locations = locations.map((location: any) => {
    if (!location || location == "" || location.length > REASONABLE_MAX_STRING_SIZE) {
      return null
    }
    return {
      query: location.location,
      label: location.location,
      group: null
    }
  })

  const labels = await readDB(`SELECT label, l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s 
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON l.keyframe_id = s.keyframe_id
    WHERE s.label is not NULL AND s.label <> '' AND s.label <> '!!anchor';`)

  // Parse special labels types
  const parsed_labels = labels.map((label: any) => {
    const labelString = String(label.label).trim()
    if (!label || label == "" || label.length > REASONABLE_MAX_STRING_SIZE) {
      return null
    }

    if (!RESERVED_START_OF_LABELS.some(reserved_string => labelString.startsWith(reserved_string))) {
      return { query: label.label, group: label.location.trim(), label: labelString }
    }

    if (labelString.startsWith("!!elevator")) {
      //e.g. '!!elevator, elevator shaft 1, floor 1 entry' <- may or may not have a comma after the toilet code
      let strippedElevator = String(labelString).replace("!!elevator", "").trim()
      if (strippedElevator.startsWith(",")) {
        strippedElevator.replace(",", " ")
      }
      const splitElevator = strippedElevator.split(",")

      if (splitElevator.length == 0) {
        console.log(`Error parsing special label ${label.label}`)
        return null
      }

      return {
        query: label.label,
        group: splitElevator[1].trim(), // e.g. 'Elevator Shaft 1'
        label: splitElevator[2]?.trim() ?? label.location // e.g. 'Floor 1 Entry'
      }
    } else if (labelString.startsWith("!!toilet")) {
      // e.g. '!!toilet, description of toilet' <- may or may not have a comma after the toilet code
      let toiletDescriptor = String(labelString).replace("!!toilet", "").trim()
      if (toiletDescriptor.startsWith(",")) {
        toiletDescriptor = toiletDescriptor.replace(",", "").trim()
      }

      return {
        query: label.label,
        group: label.location.trim(),
        label: toiletDescriptor
      }
    } else {
      return null
    }
  }).filter((label: any) => label !== null)

  res.json([...parsed_locations, ...parsed_labels])
}

export async function getPointWithLocationGroupOrLabelName(req: Request, res: Response) {
  const name = String(req.params.floor).trim()
  console.log("Calling with", name)

  if (!name || name == "" || name.length > REASONABLE_MAX_STRING_SIZE) {
    res.status(400).send("Invalid Arguments").end()
    return
  }

  // Get FIRST node which has that location/label
  const nodeWithSpecialLabel = await readDB(`SELECT n.keyframe_id, s.label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ? LIMIT 1`, [name], true)

  if (nodeWithSpecialLabel) {
    console.log("Found a label", nodeWithSpecialLabel)
    res.json(nodeWithSpecialLabel)
    return
  }

  const firstNodeWithLocation = await readDB(`SELECT n.keyframe_id, l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = ? LIMIT 1`, [name], true)
  if (firstNodeWithLocation) {
    res.json(firstNodeWithLocation)
    return
  }
  else {
    console.log("Could not find")
    res.status(404).send("Could not find any nodes with that location").end();
    return
  }
}