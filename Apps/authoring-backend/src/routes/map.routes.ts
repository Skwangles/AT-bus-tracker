import { Router } from "express";
import { getMapPoints, getAllLocationGroups, getLocationGroupImageByName } from "../controllers/map.controller";

const app = Router();

app.get('/api/v1/maps/:name/image', getLocationGroupImageByName)

app.get('/api/v1/maps/:name', getMapPoints)

app.get('/api/v1/maps', getAllLocationGroups)


export default app;