import { Router } from 'express';
import { getLabels, addLabel, deleteLabel, updateLabel } from '../controllers/labels.controller';

const router = Router();

// Route to fetch all labels for a specific keyframe_id
router.get('/api/v1/labels/:id', getLabels);

// Route to add a new label for a specific keyframe_id
router.post('/api/v1/labels/:id', addLabel);

router.put('/api/v1/labels/:id', updateLabel);

// Route to delete a label for a specific keyframe_id
router.delete('/api/v1/labels/:id', deleteLabel);

export default router;
