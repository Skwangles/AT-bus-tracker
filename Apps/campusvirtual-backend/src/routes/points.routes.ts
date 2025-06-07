import { Router } from "express";
import { getFirstPointId, pathfindFromPointId, findNeigboursFromPointId, getPointInfoFromId, getRandomPointId } from "../controllers/points.controller";

const router = Router();

router.get("/first", getFirstPointId);
router.get('/random', getRandomPointId);
router.get("/:id", getPointInfoFromId);
router.get("/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m", findNeigboursFromPointId);
router.get("/:id/path/:location", pathfindFromPointId);

export default router;