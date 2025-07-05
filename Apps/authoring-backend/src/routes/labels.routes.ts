import { Router } from 'express';
import { getLabels, addLabel, deleteLabel, updateLabel, updateLabelPosition, getLabelTypes } from '../controllers/labels.controller';

const router = Router();

// Route to fetch all labels for a specific keyframe_id
router.get('/api/v1/labels/:id', getLabels as any);

// Route to add a new label for a specific keyframe_id
router.post('/api/v1/labels/:id', addLabel as any);

// Route to update a label
router.put('/api/v1/labels/:id', updateLabel as any);

// Route to update label position
router.patch('/api/v1/labels/:id/position', updateLabelPosition as any);

// Route to delete a label for a specific keyframe_id
router.delete('/api/v1/labels/:id', deleteLabel as any);

// Route to get available label types
router.get('/api/v1/labels/types', getLabelTypes as any);

export default router;
