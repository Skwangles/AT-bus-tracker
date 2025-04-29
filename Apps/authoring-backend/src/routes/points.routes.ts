import { Router } from "express";
import { createNewPoint, findNeigboursFromPointId, getFirstPointId, getPointInfoFromId, pathfindFromPointId } from "../controllers/points.controller";

const app = Router();

app.get('/api/v1/point/:id/path/:location', pathfindFromPointId);

app.get('/api/v1/point/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m', findNeigboursFromPointId)

app.get('/api/v1/point/:id', getPointInfoFromId)

app.get('/api/v1/point', getFirstPointId)

// Add new route for creating points
app.post('/api/v1/point', createNewPoint)

export default app;
