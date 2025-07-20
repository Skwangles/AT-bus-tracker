import { Router } from "express";
import { 
  createNewPoint, 
  findNeigboursFromPointId, 
  getFirstPointId, 
  getPointInfoFromId, 
  pathfindFromPointId, 
  getRandomPointId,
  getNearbyPoints,
  getClusteringStats,
  getPointImage,
  getPointLabels,
  addPointLabel,
  updatePointLabel,
  deleteOtherNode
} from "../controllers/points.controller";

const app = Router();

app.get('/first', getFirstPointId);
app.get('/random', getRandomPointId);
app.get('/:id', getPointInfoFromId);
app.get('/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m', findNeigboursFromPointId);
app.get('/:id/path/:location', pathfindFromPointId);

// Extra endpoints (not in sitexplorer-backend, keep as is)
app.post('/api/v1/point', createNewPoint)
app.get('/api/v1/point/:id/nearby', getNearbyPoints as any);
app.get('/api/v1/points/clustering/:location', getClusteringStats as any);

// New endpoints for NodeInspector
app.get('/:id/image', getPointImage);
app.get('/:id/labels', getPointLabels);
app.post('/:id/labels', addPointLabel);
app.put('/:id/labels', updatePointLabel);
app.delete('/other-nodes/:id', deleteOtherNode);

export default app;
