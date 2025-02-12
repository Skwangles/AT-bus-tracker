import { Request, Response } from 'express';
import { readDB, writeDB } from '../db'; // Import your database functions
import { TABLE_PREFIX, USE_TABLE_PREFIX } from '../consts';

// Controller to fetch labels based on keyframe_id
export const getLabels = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const query = `SELECT label FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels WHERE keyframe_id = ?`;
    const labels = await readDB(query, [id]);
    res.status(200).json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ message: 'Error fetching labels' });
  }
};

// Controller to add a new label for a specific keyframe_id
export const addLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { label } = req.body;

  try {
    const query = `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels (keyframe_id, label) VALUES (?, ?)`;
    await writeDB(query, [id, label]);
    res.status(201).json({ message: 'Label added successfully' });
  } catch (error) {
    console.error('Error adding label:', error);
    res.status(500).json({ message: 'Error adding label' });
  }
};

// Controller to add a new label for a specific keyframe_id
export const updateLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { old_label, new_label } = req.body;

  try {
    const query = `UPDATE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels SET label = ? WHERE keyframe_id = ? AND label = ?`;
    await writeDB(query, [new_label, id, old_label]);
    res.status(201).json({ message: 'Label added successfully' });
  } catch (error) {
    console.error('Error adding label:', error);
    res.status(500).json({ message: 'Error adding label' });
  }
};

// Controller to delete a label from the list for a specific keyframe_id
export const deleteLabel = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { label } = req.body;

  try {
    const query = `DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}special_labels WHERE keyframe_id = ? AND label = ?`;
    await writeDB(query, [id, label]);
    res.status(200).json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ message: 'Error deleting label' });
  }
};
