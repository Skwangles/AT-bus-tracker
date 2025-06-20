import { Request, Response } from 'express';
import { readDB, writeDB } from '../db'; // Import your database functions
import { TABLE_PREFIX, USE_TABLE_PREFIX } from '../consts';

// Controller to fetch labels based on keyframe_id
export const getLabels = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Get labels from other_nodes table first
    const otherNodesQuery = `
      SELECT label, description, type, x_trans, y_trans, z_trans 
      FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      WHERE ref_id = ? 
      ORDER BY type, label
    `;
    const otherNodesLabels = await readDB(otherNodesQuery, [id]);
    
  
    res.status(200).json({
      otherNodes: otherNodesLabels,
      legacy: legacyLabels
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ message: 'Error fetching labels' });
  }
};

// Controller to add a new label for a specific keyframe_id
export const addLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    label, 
    type = 0, 
    description = '', 
    x_offset = 0, 
    y_offset = 0.05, // Default 5% higher
    z_offset = 0,
    position_strategy = 'auto' // 'auto', 'custom', 'relative'
  } = req.body;

  try {
    // Get node coordinates for the other_nodes table
    const nodeQuery = `SELECT x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?`;
    const nodeResult = await readDB(nodeQuery, [id], true);
    
    if (!nodeResult) {
      return res.status(404).json({ message: 'Node not found' });
    }

    // Calculate position based on strategy
    let finalX, finalY, finalZ;
    
    switch (position_strategy) {
      case 'custom':
        // Use provided coordinates directly
        finalX = x_offset;
        finalY = y_offset;
        finalZ = z_offset;
        break;
        
      case 'relative':
        // Use offsets relative to the original node position
        finalX = nodeResult.x_trans + x_offset;
        finalY = nodeResult.y_trans + y_offset;
        finalZ = nodeResult.z_trans + z_offset;
        break;
        
      case 'auto':
      default:
        // Default strategy: 5% higher than original node
        finalX = nodeResult.x_trans;
        finalY = nodeResult.y_trans * 1.05;
        finalZ = nodeResult.z_trans;
        break;
    }

    // Check if label already exists for this node
    const existingLabelQuery = `
      SELECT id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      WHERE ref_id = ? AND label = ?
    `;
    const existingLabel = await readDB(existingLabelQuery, [id, label], true);
    
    if (existingLabel) {
      return res.status(409).json({ 
        message: 'Label already exists for this node',
        existing_id: existingLabel.id 
      });
    }
    
    // Insert into other_nodes table
    const otherNodesQuery = `
      INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      (ref_id, label, description, type, x_trans, y_trans, z_trans) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await writeDB(otherNodesQuery, [
      id, 
      label, 
      description, 
      type, 
      finalX, 
      finalY, 
      finalZ
    ]);
    
    // Get the ID of the inserted label
    const insertedLabelQuery = `
      SELECT id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      WHERE ref_id = ? AND label = ? ORDER BY id DESC LIMIT 1
    `;
    const insertedLabel = await readDB(insertedLabelQuery, [id, label], true);
    const labelId = insertedLabel?.id;
    
    // If this is an elevator label, create elevator edges
    if (type === 1 && label.startsWith('!!elevator') && labelId) {
      try {
        // Parse elevator label to get shaft_id
        const parts = label.split(',').map((part: string) => part.trim());
        if (parts.length >= 2) {
          const shaft_id = parts[1];
          
          // Find other elevator nodes in the same shaft
          const elevatorNodesQuery = `
            SELECT id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
            WHERE type = 1 AND label LIKE ? AND ref_id != ?
          `;
          const elevatorNodes = await readDB(elevatorNodesQuery, [`%${shaft_id}%`, id]);
          
          // Create edges to all other elevator nodes in the same shaft
          for (const elevatorNode of elevatorNodes) {
            const edgeQuery = `
              INSERT OR IGNORE INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}elevator_edges 
              (shaft_id, id0, id1) VALUES (?, ?, ?)
            `;
            await writeDB(edgeQuery, [shaft_id, labelId, elevatorNode.id]);
          }
        }
      } catch (elevatorError) {
        console.warn('Failed to create elevator edges:', elevatorError);
        // Don't fail the entire operation if elevator edge creation fails
      }
    }
    
    res.status(201).json({ 
      message: 'Label added successfully',
      label_id: labelId,
      position: {
        x: finalX,
        y: finalY,
        z: finalZ
      },
      strategy: position_strategy
    });
  } catch (error) {
    console.error('Error adding label:', error);
    res.status(500).json({ message: 'Error adding label', error: (error as Error).message });
  }
};

// Controller to update a label for a specific keyframe_id
export const updateLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { old_label, new_label, type = 0, description = '' } = req.body;

  try {
    // Update in other_nodes table
    const otherNodesQuery = `
      UPDATE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
      SET label = ?, description = ?, type = ? 
      WHERE ref_id = ? AND label = ?
    `;
    await writeDB(otherNodesQuery, [new_label, description, type, id, old_label]);
    
    
    res.status(200).json({ message: 'Label updated successfully' });
  } catch (error) {
    console.error('Error updating label:', error);
    res.status(500).json({ message: 'Error updating label' });
  }
};

// Controller to delete a label from the list for a specific keyframe_id
export const deleteLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { label } = req.body;

  try {
    // Delete from other_nodes table
    const otherNodesQuery = `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes WHERE ref_id = ? AND label = ?`;
    await writeDB(otherNodesQuery, [id, label]);
    
    res.status(200).json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ message: 'Error deleting label' });
  }
};
