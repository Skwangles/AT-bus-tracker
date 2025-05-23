import { Router } from "express";
import { getAllSearchableLabels, getPointWithLocationGroupOrLabelName } from "../controllers/locationGroups.controller";

const app = Router();

app.get('/api/v1/labels', getAllSearchableLabels)

app.get('/api/v1/locationgroup/:locationgroup/point/', getPointWithLocationGroupOrLabelName)


export default app;