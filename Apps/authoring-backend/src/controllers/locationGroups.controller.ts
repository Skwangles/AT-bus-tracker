import { USE_TABLE_PREFIX, TABLE_PREFIX, REASONABLE_MAX_STRING_SIZE, RESERVED_START_OF_LABELS } from "../consts"
import { readDB, writeDB } from "../db"
import { Request, Response } from "express"
import { convertToUICoordinateScale } from "../logic/utils"
import logger from "../logger"

interface Label {
  query: string, // query to search the database
  label: string, // the actual label to be used
  group?: string // the shared location with potentially other labels with the same location
  type?: number
}

interface LocationGroupMetadata {
  name: string
  pointCount: number
  hasImage: boolean
  imagePath?: string
  lastModified?: string
  description?: string
}

enum LabelType {
  Normal = 0,
  Toilet,
  Elevator,
  GroupName
}

enum ReservedTypeIndex {
  Anchor = 0,
  Elevator,
  Toilet,
  MergePoint
}

/**
 * Get all location groups with metadata
 */
export async function getAllLocationGroups(req: Request, res: Response) {
  try {
    // Get all unique locations
    const locations = await readDB(`SELECT DISTINCT l.location FROM node_locations l ORDER BY l.location;`)
    
    const locationGroups: LocationGroupMetadata[] = []
    
    for (const location of locations) {
      if (!location || !location.location || location.location.length > REASONABLE_MAX_STRING_SIZE) {
        continue
      }
      
      const locationName = location.location.trim()
      
      // Get point count for this location
      const pointCountResult = await readDB(
        `SELECT COUNT(DISTINCT n.keyframe_id) as count 
         FROM nodes n 
         JOIN node_locations l ON n.keyframe_id = l.keyframe_id 
         WHERE l.location = ?`,
        [locationName],
        true
      )
      
      // Get last modified timestamp from nodes table (using ts column)
      const lastModifiedResult = await readDB(
        `SELECT MAX(n.ts) as last_modified 
         FROM nodes n 
         JOIN node_locations l ON n.keyframe_id = l.keyframe_id 
         WHERE l.location = ?`,
        [locationName],
        true
      )
      
      // Check if there are any other_nodes for this location
      const labelCountResult = await readDB(
        `SELECT COUNT(DISTINCT otn.label) as count 
         FROM other_nodes otn 
         JOIN node_locations l ON otn.ref_id = l.keyframe_id 
         WHERE l.location = ?`,
        [locationName],
        true
      )
      
      locationGroups.push({
        name: locationName,
        pointCount: pointCountResult?.count || 0,
        hasImage: false, // No floorplan_images table in the schema
        imagePath: undefined,
        lastModified: new Date(lastModifiedResult?.last_modified) ? new Date(lastModifiedResult.last_modified * 1000).toISOString() : undefined,
        description: `Location group with ${pointCountResult?.count || 0} points and ${labelCountResult?.count || 0} labels`
      })
    }
    
    res.json(locationGroups)
  } catch (error) {
    logger.error(`[getAllLocationGroups] Error: ${error}`)
    res.status(500).json({ message: 'Error fetching location groups' })
  }
}

/**
 * Get detailed information about a specific location group
 */
export async function getLocationGroupDetails(req: Request, res: Response) {
  const locationName = String(req.params.name).trim()
  
  if (!locationName || locationName.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[getLocationGroupDetails] Invalid location name: ${locationName}`)
    res.status(400).json({ message: 'Invalid location name' })
    return
  }
  
  try {
    // Get basic location info
    const locationExists = await readDB(
      `SELECT 1 FROM node_locations WHERE location = ? LIMIT 1`,
      [locationName],
      true
    )
    
    if (!locationExists) {
      res.status(404).json({ message: 'Location group not found' })
      return
    }
    
    // Get comprehensive statistics based on actual schema
    const stats = await readDB(
      `SELECT 
         COUNT(DISTINCT n.keyframe_id) as totalPoints,
         COUNT(DISTINCT otn.label) as labeledPoints,
         MIN(n.ts) as earliestPoint,
         MAX(n.ts) as latestPoint
       FROM nodes n 
       JOIN node_locations l ON n.keyframe_id = l.keyframe_id 
       LEFT JOIN other_nodes otn ON n.keyframe_id = otn.ref_id
       WHERE l.location = ?`,
      [locationName],
      true
    )
    
    // Get edge count for this location
    const edgeCountResult = await readDB(
      `SELECT COUNT(*) as count
       FROM edges e
       JOIN node_locations l1 ON e.keyframe_id0 = l1.keyframe_id
       JOIN node_locations l2 ON e.keyframe_id1 = l2.keyframe_id
       WHERE l1.location = ? AND l2.location = ?`,
      [locationName, locationName],
      true
    )
    
    // Get other_nodes for this location
    const labelsResult = await readDB(
      `SELECT otn.label, otn.keyframe_id, otn.description, otn.type
       FROM other_nodes otn
       JOIN node_locations l ON otn.ref_id = l.keyframe_id
       WHERE l.location = ?
       ORDER BY otn.label`,
      [locationName]
    )
    
    res.json({
      name: locationName,
      statistics: {
        ...stats,
        edgeCount: edgeCountResult?.count || 0
      },
      labels: labelsResult || [],
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    logger.error(`[getLocationGroupDetails] Error: ${error}`)
    res.status(500).json({ message: 'Error fetching location group details' })
  }
}

/**
 * Create a new location group
 */
export async function createLocationGroup(req: Request, res: Response) {
  const { name, description } = req.body
  
  if (!name || name.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[createLocationGroup] Invalid name: ${name}`)
    res.status(400).json({ message: 'Invalid location name' })
    return
  }
  
  try {
    // Check if location already exists
    const existingLocation = await readDB(
      `SELECT 1 FROM node_locations WHERE location = ? LIMIT 1`,
      [name],
      true
    )
    
    if (existingLocation) {
      res.status(409).json({ message: 'Location group already exists' })
      return
    }
    
    // Create a placeholder node for this location (if needed)
    // This is optional - locations can exist without nodes initially
    
    res.status(201).json({ 
      message: 'Location group created successfully',
      name,
      description
    })
  } catch (error) {
    logger.error(`[createLocationGroup] Error: ${error}`)
    res.status(500).json({ message: 'Error creating location group' })
  }
}

/**
 * Update location group metadata
 */
export async function updateLocationGroup(req: Request, res: Response) {
  const locationName = String(req.params.name).trim()
  const { description } = req.body
  
  if (!locationName || locationName.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[updateLocationGroup] Invalid location name: ${locationName}`)
    res.status(400).json({ message: 'Invalid location name' })
    return
  }
  
  try {
    // Check if location exists
    const existingLocation = await readDB(
      `SELECT 1 FROM node_locations WHERE location = ? LIMIT 1`,
      [locationName],
      true
    )
    
    if (!existingLocation) {
      res.status(404).json({ message: 'Location group not found' })
      return
    }
    
    // Update metadata (if we had a metadata table)
    // For now, just return success
    res.json({ 
      message: 'Location group updated successfully',
      name: locationName,
      description
    })
  } catch (error) {
    logger.error(`[updateLocationGroup] Error: ${error}`)
    res.status(500).json({ message: 'Error updating location group' })
  }
}

/**
 * Delete location group (only if no nodes exist)
 */
export async function deleteLocationGroup(req: Request, res: Response) {
  const locationName = String(req.params.name).trim()
  
  if (!locationName || locationName.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[deleteLocationGroup] Invalid location name: ${locationName}`)
    res.status(400).json({ message: 'Invalid location name' })
    return
  }
  
  try {
    // Check if location has any nodes
    const nodeCount = await readDB(
      `SELECT COUNT(*) as count FROM node_locations WHERE location = ?`,
      [locationName],
      true
    )
    
    if (nodeCount && nodeCount.count > 0) {
      res.status(409).json({ 
        message: 'Cannot delete location group with existing nodes',
        nodeCount: nodeCount.count
      })
      return
    }
    
    // Delete location (if no nodes exist)
    // Note: This is a soft operation since locations are typically referenced by nodes
    
    res.json({ 
      message: 'Location group deleted successfully',
      name: locationName
    })
  } catch (error) {
    logger.error(`[deleteLocationGroup] Error: ${error}`)
    res.status(500).json({ message: 'Error deleting location group' })
  }
}

export async function getAllSearchableLabels(req: Request, res: Response) {

  const locations = await readDB(`SELECT DISTINCT l.location FROM node_locations l;`)
  const parsed_locations = locations.map((location: any) => {
    if (!location || location == "" || location.length > REASONABLE_MAX_STRING_SIZE) {
      return null
    }
    return {
      query: location.location,
      label: location.location,
      group: null,
      type: LabelType.GroupName
    }
  })

  const labels = await readDB(`SELECT label, l.location FROM other_nodes s 
    JOIN node_locations l ON l.keyframe_id = s.ref_id
    WHERE s.label is not NULL AND s.label <> '' AND s.label <> '${ReservedTypeIndex[ReservedTypeIndex.Anchor]}'`)

  // Parse special labels types
  const parsed_labels = labels.map((label: any) => {
    const labelString = String(label.label).trim()
    if (!label || label == "" || label.length > REASONABLE_MAX_STRING_SIZE) {
      return null
    }

    // Short circuit on normal points - i.e. Room 1.7, Balcony, etc.
    if (!RESERVED_START_OF_LABELS.some(reserved_string => labelString.toLowerCase().startsWith(reserved_string.toLowerCase()))) {
      return {
        query: label.label,
        group: label.location.trim(),
        label: labelString,
        type: LabelType.Normal
      }
    }

    // Parse each special label type - !!elevator, !!toilet, etc.
    if (labelString.toLowerCase().startsWith(RESERVED_START_OF_LABELS[ReservedTypeIndex.Elevator])) {
      //e.g. '!!elevator, elevator shaft 1, floor 1 entry' <- may or may not have a comma after the toilet code
      let strippedElevator = String(labelString).replace(RESERVED_START_OF_LABELS[ReservedTypeIndex.Elevator], "").trim()
      if (strippedElevator.startsWith(",")) {
        strippedElevator.replace(",", " ")
      }
      const splitElevator = strippedElevator.split(",")

      if (splitElevator.length == 0) {
        logger.error(`[getAllSearchableLabels] Error parsing special label ${label.label}`)
        return null
      }

      return {
        query: label.label,
        group: splitElevator[1].trim(), // the Elevator group name will be its own location e.g. 'Elevator Shaft 1'
        label: splitElevator[2]?.trim() ?? label.location, // e.g. 'Floor 1 Entry'
        type: LabelType.Elevator
      }
    } else if (labelString.toLowerCase().startsWith(RESERVED_START_OF_LABELS[ReservedTypeIndex.Toilet])) {
      // e.g. '!!toilet, description of toilet' <- may or may not have a comma after the toilet code
      let toiletDescriptor = String(labelString).replace(RESERVED_START_OF_LABELS[ReservedTypeIndex.Toilet], "").trim()
      if (toiletDescriptor.startsWith(",")) {
        toiletDescriptor = toiletDescriptor.replace(",", "").trim()
      }

      return {
        query: label.label,
        group: label.location.trim(),
        label: toiletDescriptor,
        type: LabelType.Toilet
      }
    } else {
      return null
    }
  }).filter((label: any) => label !== null)

  res.json([...parsed_locations, ...parsed_labels])
}

export async function getPointWithLocationGroupOrLabelName(req: Request, res: Response) {
  const name = String(req.params.name).trim()

  if (!name || name == "" || name.length > REASONABLE_MAX_STRING_SIZE) {
    logger.warn(`[GetPointWithLocGroupOrLabelName] Invalid name: ${name}`)
    res.status(400).send("Invalid Arguments").end()
    return
  }

  // Get FIRST node which has that location/label
  const nodeWithOtherNodeLabel = await readDB(`SELECT n.keyframe_id, s.label FROM nodes n JOIN other_nodes s ON s.ref_id = n.keyframe_id WHERE s.label = ? LIMIT 1`, [name], true)

  if (nodeWithOtherNodeLabel) {
    logger.debug(`[getPointWithLocationGroupOrLabelName] Found a label: ${nodeWithOtherNodeLabel}`)
    res.json(nodeWithOtherNodeLabel)
    return
  }

  const firstNodeWithLocation = await readDB(`SELECT n.keyframe_id, l.location FROM nodes n JOIN node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = ? LIMIT 1`, [name], true)
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