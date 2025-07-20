import express, { Router } from "express";
import fs from "fs";
import { addLabelToMapPoint, connectTwoPoints, deleteLabel, deleteLabelFromMapOnly, disconnectTwoPoints, updateFloorplanImage, updateMapPoint, updateMultipleMapPoints } from "../controllers/editing.controller";
import multer from "multer";
import { FLOORPLAN_IMG_DIR } from "../consts";
import logger from "../logger";

const app = Router();

// Configure Multer for file upload handling with enhanced logging
const storage = multer.diskStorage({
  destination: (
    req: any,
    file: any,
    cb: (arg0: null, arg1: string) => void
  ) => {
    const uploadDir = FLOORPLAN_IMG_DIR;
    const location = req.params.name;
    
    logger.info(`[multer:destination] Processing upload for location: ${location}`, {
      location: location,
      fileName: file.originalname,
      uploadDir: uploadDir,
      fileSize: file.size,
      mimeType: file.mimetype
    });

    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      logger.info(`[multer:destination] Creating upload directory: ${uploadDir}`, {
        location: location,
        uploadDir: uploadDir
      });
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    logger.info(`[multer:destination] Directory ready for upload`, {
      location: location,
      uploadDir: uploadDir,
      directoryExists: fs.existsSync(uploadDir)
    });

    cb(null, uploadDir);
  },
  filename: (
    req: any,
    file: { originalname: any },
    cb: (arg0: null, arg1: any) => void
  ) => {
    const location = req.params.name;
    const originalName = file.originalname;
    
    logger.info(`[multer:filename] Setting filename for upload`, {
      location: location,
      originalName: originalName,
      finalName: originalName // Using original filename as per current logic
    });

    // Use the original filename
    cb(null, originalName);
  },
});

// Add file filter for additional validation and logging
const fileFilter = (req: any, file: any, cb: any) => {
  const location = req.params.name;
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  logger.info(`[multer:fileFilter] Validating uploaded file`, {
    location: location,
    fileName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    allowedTypes: allowedMimeTypes
  });

  if (allowedMimeTypes.includes(file.mimetype)) {
    logger.info(`[multer:fileFilter] File validation passed`, {
      location: location,
      fileName: file.originalname,
      mimeType: file.mimetype
    });
    cb(null, true);
  } else {
    logger.error(`[multer:fileFilter] File validation failed - invalid mime type`, {
      location: location,
      fileName: file.originalname,
      mimeType: file.mimetype,
      allowedTypes: allowedMimeTypes
    });
    cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
  }
};

// Add limits for file size validation
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 1
};

export const uploadFloorplanImageMiddleware = multer({ 
  storage,
  fileFilter,
  limits
});

// Add error handling middleware for multer errors
const handleMulterError = (error: any, req: any, res: any, next: any) => {
  const location = req.params.name;
  
  if (error instanceof multer.MulterError) {
    logger.error(`[multer:error] Multer error occurred`, {
      location: location,
      errorCode: error.code,
      errorMessage: error.message,
      field: error.field
    });

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          error: 'File too large',
          message: 'Maximum file size is 10MB',
          maxSize: '10MB'
        });
        break;
      case 'LIMIT_FILE_COUNT':
        res.status(413).json({
          error: 'Too many files',
          message: 'Only one file allowed per upload'
        });
        break;
      default:
        res.status(400).json({
          error: 'File upload error',
          message: error.message
        });
    }
  } else if (error) {
    logger.error(`[multer:error] Non-multer error occurred`, {
      location: location,
      error: error.message,
      stack: error.stack
    });
    res.status(400).json({
      error: 'File upload error',
      message: error.message
    });
  } else {
    next();
  }
};


app.post("/maps/:name/image", uploadFloorplanImageMiddleware.single("file"), handleMulterError, updateFloorplanImage)

app.post("/maps/:name/updatemultiple", updateMultipleMapPoints);

app.post("/maps/:name/update", updateMapPoint);

app.post("/point/:id/label", addLabelToMapPoint)

app.delete("/point/:id/delete", deleteLabel)

app.delete("/point/:id/visually-delete/:loc", deleteLabelFromMapOnly)

app.post("/point/:id1/connect/:id2", connectTwoPoints);

app.delete("/point/:id1/connect/:id2", disconnectTwoPoints);

export default app;
