import { Router } from "express";
import { 
  createNewPoint, 
  findNeigboursFromPointId, 
  getFirstPointId, 
  getPointInfoFromId, 
  pathfindFromPointId, 
  getRandomPointId,
  getNearbyPoints,
  getClusteringStats
} from "../controllers/points.controller";

const app = Router();

app.get('/api/v1/point/:id/path/:location', pathfindFromPointId);

app.get('/api/v1/point/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m', findNeigboursFromPointId)

app.get('/api/v1/point/:id', getPointInfoFromId)

app.get('/api/v1/point', getFirstPointId)

// Add new route for creating points
app.post('/api/v1/point', createNewPoint)

// Add random point endpoint
app.get('/api/v1/point/random', getRandomPointId);

// Add clustering-related endpoints
app.get('/api/v1/point/:id/nearby', getNearbyPoints as any);
app.get('/api/v1/points/clustering/:location', getClusteringStats as any);

export default app;
