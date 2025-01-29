
import { Router } from "express";
import { getImageByTs, getImageById } from "../controllers/image.controller";

const app = Router();

app.get('/api/v1/image/:resolution/:ts', getImageByTs)

app.get('/api/v1/image/:id', getImageById)

export default app;