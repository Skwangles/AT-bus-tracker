import express, { Router } from "express";
import fs from "fs";
import { addLabelToMapPoint, connectTwoPoints, deleteLabel, deleteLabelFromMapOnly, disconnectTwoPoints, updateFloorplanImage, updateMapPoint, updateMultipleMapPoints } from "../controllers/editing.controller";
import multer from "multer";
import { FLOORPLAN_IMG_DIR } from "../consts";
const app = Router();


// Configure Multer for file upload handling
const storage = multer.diskStorage({
  destination: (
    req: any,
    file: any,
    cb: (arg0: null, arg1: string) => void
  ) => {
    // Ensure the uploads directory exists
    const uploadDir = FLOORPLAN_IMG_DIR;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (
    req: any,
    file: { originalname: any },
    cb: (arg0: null, arg1: any) => void
  ) => {
    // Use the original filename
    cb(null, file.originalname);
  },
});

export const uploadFloorplanImageMiddleware = multer({ storage });


app.post("/api/v1/floorplans/:name/image", uploadFloorplanImageMiddleware.single("file"), updateFloorplanImage)

app.post("/api/v1/floorplans/:name/updatemultiple", updateMultipleMapPoints);

app.post("/api/v1/floorplans/:name/update", updateMapPoint);

app.post("/api/v1/point/:id/label", addLabelToMapPoint)

app.delete("/api/v1/point/:id/delete", deleteLabel)

app.delete("/api/v1/point/:id/visually-delete", deleteLabelFromMapOnly)

app.post("/api/v1/point/:id1/connect/:id2", connectTwoPoints);

app.delete("/api/v1/point/:id1/connect/:id2", disconnectTwoPoints);

export default app;
