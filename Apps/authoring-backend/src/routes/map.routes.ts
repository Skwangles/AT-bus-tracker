import { Router } from "express";
import { 
  getMapPoints, 
  getAllLocationGroups, 
  getLocationGroupImageByName,
  hideMapPoint,
  showMapPoint,
  getHiddenPoints,
  getClusteringSuggestions,
  applyClusteringSuggestions
} from "../controllers/map.controller";

const app = Router();

app.get('/:name/image', getLocationGroupImageByName)

app.get('/:name', getMapPoints)

app.get('/', getAllLocationGroups)

// Map point management routes
app.delete('/:location/points', hideMapPoint as any);
app.post('/:location/points', showMapPoint as any);
app.get('/:location/hidden-points', getHiddenPoints as any);
app.get('/:location/clustering', getClusteringSuggestions as any);
app.post('/:location/clustering', applyClusteringSuggestions as any);

export default app;