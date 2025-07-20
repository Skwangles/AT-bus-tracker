import { Router } from "express";
import { 
  getAllSearchableLabels, 
  getPointWithLocationGroupOrLabelName,
  getAllLocationGroups,
  getLocationGroupDetails,
  createLocationGroup,
  updateLocationGroup,
  deleteLocationGroup
} from "../controllers/locationGroups.controller";

const app = Router();

// Get all location groups with metadata
app.get('/', getAllLocationGroups)

// Get detailed information about a specific location group
app.get('/:name/details', getLocationGroupDetails)

// Create a new location group
app.post('/', createLocationGroup)

// Update location group metadata
app.put('/:name', updateLocationGroup)

// Delete location group (only if no nodes exist)
app.delete('/:name', deleteLocationGroup)

// Legacy endpoints for backward compatibility
app.get('/labels', getAllSearchableLabels)
app.get('/:locationgroup/point/', getPointWithLocationGroupOrLabelName)

export default app;