import { Router } from "express";
import { getMapPoints, getAllLocationGroups, getLocationGroupImageByName, mapFeaturesEnabled } from "../controllers/map.controller";

const app = Router();

app.get('/api/v1/maps/:name/image', mapFeaturesEnabled, getLocationGroupImageByName)

app.get('/api/v1/maps/:name', mapFeaturesEnabled, getMapPoints)

app.get('/api/v1/maps', mapFeaturesEnabled, getAllLocationGroups)


export default app;