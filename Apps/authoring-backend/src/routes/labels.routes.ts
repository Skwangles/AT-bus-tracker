import { Router } from 'express';
import { getLabels, addLabel, deleteLabel, updateLabel, updateLabelPosition, getLabelTypes, getAllOtherNodes, updateOtherNodePositionById, updateOtherNodeById } from '../controllers/labels.controller';

const router = Router();

// Route to get all other_nodes with location group info
router.get('/other-nodes', getAllOtherNodes as any);

// Route to get available label types
router.get('/types', getLabelTypes as any);

// Route to fetch all labels for a specific keyframe_id
router.get('/:id', getLabels as any);

// Route to add a new label for a specific keyframe_id
router.post('/:id', addLabel as any);

// Route to update a label
router.put('/:id', updateLabel as any);

// Route to update other_node position by ID (must come before /:id/position)
router.patch('/other-node/:id/position', updateOtherNodePositionById as any);

// Route to update other_node properties by ID (label, description, type, ref_id)
router.patch('/other-node/:id', updateOtherNodeById as any);

// Route to update label position
router.patch('/:id/position', updateLabelPosition as any);

// Route to delete a label for a specific keyframe_id
router.delete('/:id', deleteLabel as any);

export default router;
