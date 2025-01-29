import { Router } from "express";
import { getAllSearchableLabels, getPointWithLocationGroupOrLabelName } from "../controllers/locationGroups.controller";

const app = Router();

app.get('/api/v1/floors', getAllSearchableLabels)

app.get('/api/v1/floor/:floor/point/', getPointWithLocationGroupOrLabelName)


export default app;