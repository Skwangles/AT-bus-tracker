import { Router } from "express";
import { getAllSearchableLabels, getPointWithLocationGroupOrLabelName, getSuggestedLocations } from "../controllers/locationGroups.controller";

const app = Router();

app.get('/labels', getAllSearchableLabels)
app.get('/suggestions', getSuggestedLocations)

app.get('/:locationgroup/point/', getPointWithLocationGroupOrLabelName)


export default app;