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
    SELECT otn.ref_id as keyframe_id, otn.label, l.location, n.x_trans as x, n.y_trans as y, n.z_trans as z
    FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes otn
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l ON otn.ref_id = l.keyframe_id
    JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n ON otn.ref_id = n.keyframe_id
    WHERE otn.label IS NOT NULL
    AND otn.label <> ''
    AND otn.label <> '${RESERVED_START_OF_LABELS[ReservedTypeIndex.Anchor]}'
    ORDER BY otn.label
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
    if (userDefinedLabel.label.includes(RESERVED_START_OF_LABELS[ReservedTypeIndex.Elevator])) {
      const elevatorParts = userDefinedLabel.label.split(',');
      const shaftName = elevatorParts[0].trim();
      if (!elevatorShaftMap.has(shaftName)) {
        elevatorShaftMap.set(shaftName, []);
      }
      elevatorShaftMap.get(shaftName)?.push(userDefinedLabelObj);
    } 
    else {
      // Handle regular labels
      const parentLabel = labelMap.get(userDefinedLabel.location);
      if (parentLabel) {
        parentLabel.children.push(userDefinedLabelObj);
      }
      labelMap.set(userDefinedLabel.label, userDefinedLabelObj);
    }
  });
}

async function linkElevatorChildren(elevatorShaftMap: Map<string, Label[]>, labelMap: Map<string, Label>){
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

  // Now all the elevators are linked, we can add each of the elevators childrens into the corresponding label in the labelMap
    // Add each of the elevators childrens into the corresponding label in the labelMap
    elevatorShaftMap.forEach((elevators) => {
      elevators.forEach((elevator) => {
        labelMap.set(elevator.query, elevator);
        labelMap.get(elevator.parents[0])?.children.push(elevator);  
      })
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
    await linkElevatorChildren(elevatorShaftMap, labelMap);

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

  // Get FIRST node which has that location/label from other_nodes
  const nodeWithOtherNodeLabel = await readDB(`SELECT otn.ref_id as keyframe_id, otn.label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes otn WHERE otn.label = ? LIMIT 1`, [name], true)

  if (nodeWithOtherNodeLabel) {
    logger.debug(`[getPointWithLocationGroupOrLabelName] Found a label in other_nodes: ${nodeWithOtherNodeLabel}`)
    res.json(nodeWithOtherNodeLabel)
    return
  }

  // Fallback to user_defined_labels
  const nodeWithUserDefinedLabel = await readDB(`SELECT n.keyframe_id, s.label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}user_defined_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ? LIMIT 1`, [name], true)

  if (nodeWithUserDefinedLabel) {
    logger.debug(`[getPointWithLocationGroupOrLabelName] Found a label in user_defined_labels: ${nodeWithUserDefinedLabel}`)
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

/**
 * GET /api/v1/locationGroups/suggestions
 * Returns a list of suggested starting locations for the landing page.
 * Each suggestion has a title, description, and pointId.
 */
export async function getSuggestedLocations(req: Request, res: Response) {
  try {
    // Define the suggested locations with their corresponding location names in the database
    const suggestedLocations = [
      {
        title: 'Campus Entrance',
        description: 'Outside the front of the building',
        locationName: 'outdoors'
      },
      {
        title: 'Level G',
        description: 'Begin from the ground floor',
        locationName: 'Level G'
      },
      {
        title: 'Level 1',
        description: 'Begin from the first floor',
        locationName: 'Level 1'
      },
      {
        title: 'Level 2',
        description: 'Start from the second floor',
        locationName: 'Level 2'
      },
      {
        title: 'Level 3',
        description: 'Begin from the top floor',
        locationName: 'Level 3'
      }
    ];

    // Fetch point IDs for each location
    const locationsWithPoints = await Promise.all(
      suggestedLocations.map(async (location) => {
        // Get the first node with this location
        const nodeWithLocation = await readDB(
          `SELECT n.keyframe_id 
           FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes n 
           JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}node_locations l 
           ON n.keyframe_id = l.keyframe_id 
           WHERE l.location = ? 
           LIMIT 1`,
          [location.locationName],
          true
        );

        return {
          ...location,
          pointId: nodeWithLocation ? nodeWithLocation.keyframe_id : null
        };
      })
    );

    // Filter out any locations that don't have a valid point ID
    const validLocations = locationsWithPoints.filter(loc => loc.pointId !== null);

    if (validLocations.length === 0) {
      logger.warn('No valid suggested locations found in the database');
      res.status(404).json({ error: 'No suggested locations available' });
      return;
    }

    res.json(validLocations);
  } catch (error) {
    logger.error('Error getting suggested locations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
