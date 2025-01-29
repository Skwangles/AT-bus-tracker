import express, { Router } from "express";
import path from "path";
import bodyParser from "body-parser";
import {
  ENABLE_AUTHORING_PAGE,
} from "../consts";
import { addLabelToMapPoint, connectTwoPoints, deleteLabel, disconnectTwoPoints, updateMapPoint, updateMultipleMapPoints } from "../controllers/editing.controller";
import { updateFloorplanImage, uploadFloorplanImageMiddleware } from "../controllers/image.controller";
const app = Router();

if (ENABLE_AUTHORING_PAGE) {
  app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(express.static(path.join(__dirname, "../authoring/dist")));

  app.get("/authoring", function (req, res) {
    res.sendFile(path.join(__dirname, "../authoring/dist", "index.html"));
  });

  app.post("/api/v1/floorplans/:name/image", uploadFloorplanImageMiddleware.single("file"), updateFloorplanImage)

  app.post("/api/v1/floorplans/:name/updatemultiple", updateMultipleMapPoints);

  app.post("/api/v1/floorplans/:name/update", updateMapPoint);

  app.post("/api/v1/point/:id/label", addLabelToMapPoint)

  app.delete("/api/v1/point/:id/delete", deleteLabel)

  app.post("/api/v1/point/:id1/connect/:id2", connectTwoPoints);

  app.delete("/api/v1/point/:id1/connect/:id2", disconnectTwoPoints);
}

export default app;
