import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE, RESERVED_START_OF_LABELS } from "../consts"
import { readDB } from "../db"
import { Request, Response } from "express"
import { convertToUICoordinateScale } from "../logic/utils"
import logger from "../logger"
import { LabelType } from "../types"
import { LabelStrategyFactory } from "../utils/labelStrategies"

interface Label {
  query: string;
  label: string;
  type: number;
  parents: string[];
  children: Label[];
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
}

interface LocationResult {
  location: string;
  x: number;
  y: number;
  z: number;
}

interface SpecialLabelResult {
  label: string;
  location: string;
  x: number;
  y: number;
  z: number;
}

enum ReservedTypeIndex {
  Anchor = 0,
  Elevator,
  Toilet,
  MergePoint
}

export async function getAllSearchableLabels(req: Request, res: Response) {
  try {
    // Get all locations with their coordinates
    const locations = await readDB(`
      SELECT DISTINCT l.location, n.x_trans as x, n.y_trans as y, n.z_trans as z 
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l
      JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON n.keyframe_id = l.keyframe_id;
    `) as LocationResult[];

    // Get all special labels with their locations and coordinates
    const specialLabels = await readDB(`
      SELECT s.label, l.location, n.x_trans as x, n.y_trans as y, n.z_trans as z 
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s 
      JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON l.keyframe_id = s.keyframe_id
      JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON n.keyframe_id = s.keyframe_id
      WHERE s.label IS NOT NULL 
      AND s.label <> '' 
      AND s.label <> '${ReservedTypeIndex[ReservedTypeIndex.Anchor]}'
    `) as SpecialLabelResult[];

    const labelMap = new Map<string, Label>();
    const elevatorShaftMap = new Map<string, Label[]>();
    
    // Process regular locations
    locations.forEach((location: LocationResult) => {
      if (!location || !location.location || location.location.length > REASONABLE_MAX_STRING_SIZE) {
        return;
      }

      const strategy = LabelStrategyFactory.createStrategy(location.location);
      const { label, parents, type } = strategy.processLabel(location.location);

      labelMap.set(location.location, {
        query: location.location,
        label,
        type,
        parents,
        children: [],
        coordinates: {
          x: location.x,
          y: location.y,
          z: location.z
        }
      });
    });

    // Process special labels
    specialLabels.forEach((specialLabel: SpecialLabelResult) => {
      if (!specialLabel || !specialLabel.label || specialLabel.label.length > REASONABLE_MAX_STRING_SIZE) {
        return;
      }

      const strategy = LabelStrategyFactory.createStrategy(specialLabel.location);
      const { label, parents, type } = strategy.processLabel(
        specialLabel.label,
        specialLabel.location
      );

      const specialLabelObj = {
        query: specialLabel.label,
        label,
        type,
        parents,
        children: [],
        coordinates: {
          x: specialLabel.x,
          y: specialLabel.y,
          z: specialLabel.z
        }
      };

      // Handle elevator labels
      if (type === LabelType.Elevator) {
        const elevatorParts = specialLabel.label.split(',');
        if (elevatorParts.length >= 2) {
          const shaftName = elevatorParts[1].trim();
          if (!elevatorShaftMap.has(shaftName)) {
            elevatorShaftMap.set(shaftName, []);
          }
          elevatorShaftMap.get(shaftName)?.push(specialLabelObj);
        }
      }

      // If this is a special label for an existing location, add it as a child
      const parentLabel = labelMap.get(specialLabel.location);
      if (parentLabel) {
        parentLabel.children.push(specialLabelObj);
      }
      
      labelMap.set(specialLabel.label, specialLabelObj);
    });

    // Link elevator children in a hierarchical structure
    elevatorShaftMap.forEach((elevators, shaftName) => {
      if (elevators.length > 1) {
        // Sort elevators by their description (last part after comma)
        elevators.sort((a, b) => {
          const aDesc = a.query.split(',')[2]?.trim() || '';
          const bDesc = b.query.split(',')[2]?.trim() || '';
          return aDesc.localeCompare(bDesc);
        });

        // Create a hierarchical structure where each elevator is a child of the previous one
        for (let i = 0; i < elevators.length - 1; i++) {
          elevators[i].children.push(elevators[i + 1]);
        }
      }
    });

    res.json(Array.from(labelMap.values()));
  } catch (error) {
    logger.error('Error getting searchable labels:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getPointWithLocationGroupOrLabelName(req: Request, res: Response) {
  const name = String(req.params.locationgroup).trim()
  console.log("Params: ", req.params)

  if (!name || name == "" || name.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[GetPointWithLocGroupOrLabelName] Invalid name: ${name}`)
    res.status(400).send("Invalid Arguments").end()
    return
  }


  // Get FIRST node which has that location/label
  const nodeWithSpecialLabel = await readDB(`SELECT n.keyframe_id, s.label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ? LIMIT 1`, [name], true)

  if (nodeWithSpecialLabel) {
    logger.debug(`[getPointWithLocationGroupOrLabelName] Found a label: ${nodeWithSpecialLabel}`)
    res.json(nodeWithSpecialLabel)
    return
  }

  const firstNodeWithLocation = await readDB(`SELECT n.keyframe_id, l.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = ? LIMIT 1`, [name], true)
  if (firstNodeWithLocation) {
    res.json(firstNodeWithLocation)
    return
  }
  else {
    logger.warn(`[GetPointWithLocGroupOrLabelName] Could not find with floorname: ${name}`)
    res.status(404).send("Could not find any nodes with that location").end();
    return
  }
}