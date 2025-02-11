import { Router } from "express";
import { getMapPoints, getAllLocationGroups, getLocationGroupImageByName, mapFeaturesEnabled } from "../controllers/map.controller";

const app = Router();

app.get('/api/v1/floorplans/:name/image', mapFeaturesEnabled, getLocationGroupImageByName)

app.get('/api/v1/floorplans/:name', mapFeaturesEnabled, getMapPoints)

app.get('/api/v1/floorplans', mapFeaturesEnabled, getAllLocationGroups)


export default app;