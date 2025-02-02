import { Router } from "express";
import { getMapPoints, getAllLocationGroups, getLocationGroupImageByName } from "../controllers/map.controller";

const app = Router();

app.get('/api/v1/floorplans/:name/image', getLocationGroupImageByName)

app.get('/api/v1/floorplans/:name', getMapPoints)

app.get('/api/v1/floorplans', getAllLocationGroups)


export default app;