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
  type: LabelType;
  parents: string[];
  children: Label[];
  pointId: number;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
}

interface LocationResult {
  location: string;
  pointId: number;
  x: number;
  y: number;
  z: number;
}

interface UserDefinedLabelResult {
  label: string;
  location: string;
  pointId: number;
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

async function getLocationGroups(){
  const locationGroups = await readDB(`
    SELECT l.location
    FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l
    WHERE l.location IS NOT NULL
    AND l.location <> ''
  `) as LocationResult[];

  return locationGroups;
}

async function getUserDefinedLabels(){
  const userDefinedLabels = await readDB(`
    SELECT s.keyframe_id, s.label, l.location, n.x_trans as x, n.y_trans as y, n.z_trans as z
    FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}user_defined_labels s
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON s.keyframe_id = l.keyframe_id
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON s.keyframe_id = n.keyframe_id
    WHERE s.label IS NOT NULL
    AND s.label <> ''
    AND s.label NOT LIKE '%- staircase%'
    AND s.label <> '${RESERVED_START_OF_LABELS[ReservedTypeIndex.Anchor]}'
    ORDER BY s.label
  `) as UserDefinedLabelResult[];

  return userDefinedLabels;
}

async function processLocationGroups(locations: LocationResult[], labelMap: Map<string, Label>){
  locations.forEach((location: LocationResult) => {
    if (!location || !location.location || location.location.length > REASONABLE_MAX_STRING_SIZE) {
      return;
    }

    const strategy = LabelStrategyFactory.createStrategy(location.location);
    const { label, parents } = strategy.processLabel(location.location);

    labelMap.set(location.location, {
      query: location.location,
      label,
      type: LabelType.GroupName,
      parents,
      children: [],
      pointId: location.pointId,
      coordinates: {
        x: location.x,
        y: location.y,
        z: location.z
      }
    });
  });
}

async function processUserDefinedLabels(userDefinedLabels: UserDefinedLabelResult[], labelMap: Map<string, Label>, elevatorShaftMap: Map<string, Label[]>){
  userDefinedLabels.forEach((userDefinedLabel: UserDefinedLabelResult) => {
    if (!userDefinedLabel || !userDefinedLabel.label || userDefinedLabel.label.length > REASONABLE_MAX_STRING_SIZE) {
      return;
    }

    const strategy = LabelStrategyFactory.createStrategy(userDefinedLabel.location);
    const { label, parents, type } = strategy.processLabel(
      userDefinedLabel.label,
      userDefinedLabel.location
    );

    const userDefinedLabelObj: Label = {
      query: userDefinedLabel.label,
      label,
      type,
      parents,
      children: [],
      pointId: userDefinedLabel.pointId,
      coordinates: {
        x: userDefinedLabel.x,
        y: userDefinedLabel.y,
        z: userDefinedLabel.z
      }
    };

    // Handle elevator shaft labels
    if (userDefinedLabel.label.includes(',')) {
      const elevatorParts = userDefinedLabel.label.split(',');
      const shaftName = elevatorParts[0].trim();
      if (!elevatorShaftMap.has(shaftName)) {
        elevatorShaftMap.set(shaftName, []);
      }
      elevatorShaftMap.get(shaftName)?.push(userDefinedLabelObj);
    } else {
      // Handle regular labels
      const parentLabel = labelMap.get(userDefinedLabel.location);
      if (parentLabel) {
        parentLabel.children.push(userDefinedLabelObj);
      }
      labelMap.set(userDefinedLabel.label, userDefinedLabelObj);
    }
  });
}

async function linkElevatorChildren(elevatorShaftMap: Map<string, Label[]>){
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
        elevators[i].children.push(elevators[i + 1] as Label);
      }
    }
  });
}

export async function getAllSearchableLabels(req: Request, res: Response) {
  try {
    // Get all locations with their coordinates
    const locations = await getLocationGroups();

    // Get all special labels with their locations and coordinates
    const userDefinedLabels = await getUserDefinedLabels();

    const labelMap = new Map<string, Label>();
    const elevatorShaftMap = new Map<string, Label[]>();
    
    await processLocationGroups(locations, labelMap);
    await processUserDefinedLabels(userDefinedLabels, labelMap, elevatorShaftMap);
    await linkElevatorChildren(elevatorShaftMap);

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
  const nodeWithUserDefinedLabel = await readDB(`SELECT n.keyframe_id, s.label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}user_defined_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ? LIMIT 1`, [name], true)

  if (nodeWithUserDefinedLabel) {
    logger.debug(`[getPointWithLocationGroupOrLabelName] Found a label: ${nodeWithUserDefinedLabel}`)
    res.json(nodeWithUserDefinedLabel)
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
