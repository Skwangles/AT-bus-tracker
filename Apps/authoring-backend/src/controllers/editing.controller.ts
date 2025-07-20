import { Request, Response } from "express";
import logger from "../logger";
import { REASONABLE_MAX_STRING_SIZE, USE_TABLE_PREFIX, TABLE_PREFIX } from "../consts";
import { writeDB, readDB } from "../db";
import { replaceNode, connectNodes, disconnectNodes } from "../logic/utils";


export async function updateMultipleMapPoints(req: Request, res: Response) {
  const { name } = req.params;
  const { points } = req.body;
  let failed = false;
  let count = 0;
  for (const point of points) {
    await writeDB(
      `UPDATE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;`,
      [point.x, point.y, point.keyframe_id, name]
    )
      .then((changes: number) => {
        if (changes > 0) {
          count++;
        }
      })
      .catch((e) => {
        res.status(404).send("Error updating point");
        console.error("Error updating point:", e);
        failed = true;
        return;
      });
      if (failed) {
        // Headers have already been sent, so we need to return
        console.error("Error updating point");
        return;
      }
  }

  console.log("updateMultipleMapPoints: Successfully updated", count, "points");
  res.sendStatus(200).end();
}

export async function updateMapPoint(req: Request, res: Response) {
  const { name } = req.params;
  const { id, x, y } = req.body;

  await writeDB(
    `UPDATE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;`,
    [x, y, id, name]
  )
    .then((changes: number) => {
      if (changes > 0) {
        res.sendStatus(200);
      } else {
        res.status(404).send("Could not find point to update");
      }
    })
    .catch(() => {
      res.status(404).send("Error updating point");
    });
}

export async function addLabelToMapPoint(req: Request, res: Response) {
  let label = String(req.body.label).trim();
  const id = Number(req.params.id);
  if (isNaN(id) || !label || label.length > REASONABLE_MAX_STRING_SIZE) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }
  
  // Get node coordinates for positioning the label
  const nodeQuery = `SELECT x_trans, y_trans, z_trans FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ?`;
  const nodeResult = await readDB(nodeQuery, [id], true);
  
  if (!nodeResult) {
    res.status(404).send("Node not found").end();
    return;
  }

  // Check if label already exists for this node
  const existingLabelQuery = `
    SELECT id FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
    WHERE ref_id = ? AND label = ?
  `;
  const existingLabel = await readDB(existingLabelQuery, [id, label], true);
  
  if (existingLabel) {
    res.status(409).send("Label already exists for this node").end();
    return;
  }

  // Insert into other_nodes table
  const changes = await writeDB(
    `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}other_nodes 
     (ref_id, label, description, type, x_trans, y_trans, z_trans) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, label, label, 0, nodeResult.x_trans, nodeResult.y_trans * 1.05, nodeResult.z_trans]
  );
  
  res
    .status(changes > 0 ? 200 : 409)
    .send(
      changes > 0
        ? "Point labelled"
        : "Error occurred - The point may be a border point, which cannot be deleted"
    );
}

export async function deleteLabelFromMapOnly(req: Request, res: Response) {

  const id = Number(req.params.id);
  const loc = String(req.params.loc)
  if (isNaN(id) || !loc) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }
  const result = await writeDB(`DELETE FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points WHERE location = ? AND keyframe_id = ?`, [loc, id])
  res
    .status(result > 0 ? 200 : 409)
    .send(
      result
        ? "Point deleted from map"
        : "Error occurred - The point may be a border point, which cannot be deleted"
    );
}

export async function deleteLabel(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }
  const result = await replaceNode(Number(id));
  res
    .status(result ? 200 : 409)
    .send(
      result
        ? "Point deleted"
        : "Error occurred - The point may be a border point, which cannot be deleted"
    );
}


export async function connectTwoPoints(req: Request, res: Response) {
  const id1 = Number(req.params.id1);
  const id2 = Number(req.params.id2);

  if (isNaN(id1) || isNaN(id2)) {
    res.status(400).send("Invalid Arguments").end();
    return;
  }

  const is_on_same_level = await readDB(
    `SELECT kf1.keyframe_id, kf2.keyframe_id, kf1.location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points kf1 JOIN ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points kf2 ON kf1.location = kf2.location AND kf1.keyframe_id <> kf2.keyframe_id AND kf1.keyframe_id = ? AND kf2.keyframe_id = ? LIMIT 1;`,
    [id1, id2]
  );
  if (is_on_same_level.length == 0) {
    res.status(409).send("Points are not on the same level!");
    return;
  }

  const result = await connectNodes(Number(id1), Number(id2));
  res
    .status(result ? 201 : 409)
    .send(
      result
        ? "Points connected"
        : "Error occurred - The points may already be connected, or are border points!"
    );
}



export async function disconnectTwoPoints(req: Request, res: Response) {
  const { id1, id2 } = req.params;

  const is_edge = await readDB(
    `SELECT * FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""
    }edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?) LIMIT 1;`,
    [id1, id2, id2, id1]
  );
  if (is_edge.length == 0) {
    res.status(409).send("Points are not connected!");
    return;
  }

  const result = await disconnectNodes(Number(id1), Number(id2));

  res
    .status(result ? 201 : 409)
    .send(
      result
        ? "Points disconnected"
        : "Error occurred - The points may not be connected!"
    );
}

export async function updateFloorplanImage(req: Request, res: Response) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2, 15)
  
  logger.info(`[updateFloorplanImage:${requestId}] Starting image upload request`, {
    location: req.params.name,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  })

  try {
    const { name } = req.params
    const file = req.file

    // Validate location parameter
    if (!name || name.trim().length === 0) {
      logger.error(`[updateFloorplanImage:${requestId}] Invalid location name provided`, {
        location: name,
        error: 'Empty or missing location name'
      })
      res.status(400).send("Invalid location name provided.")
      return
    }

    // Validate file presence
    if (!file) {
      logger.error(`[updateFloorplanImage:${requestId}] No file provided in upload`, {
        location: name,
        files: req.files,
        body: Object.keys(req.body || {})
      })
      res.status(400).send("No file uploaded.")
      return
    }

    // Log file details
    logger.info(`[updateFloorplanImage:${requestId}] File received`, {
      location: name,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      encoding: file.encoding,
      destination: file.destination,
      filename: file.filename,
      path: file.path
    })

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedMimeTypes.includes(file.mimetype)) {
      logger.error(`[updateFloorplanImage:${requestId}] Invalid file type`, {
        location: name,
        fileName: file.originalname,
        mimeType: file.mimetype,
        allowedTypes: allowedMimeTypes
      })
      res.status(415).send("Invalid file type. Only image files are allowed.")
      return
    }

    // Validate file size (10MB limit)
    const maxFileSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxFileSize) {
      logger.error(`[updateFloorplanImage:${requestId}] File too large`, {
        location: name,
        fileName: file.originalname,
        fileSize: file.size,
        maxFileSize: maxFileSize,
        sizeInMB: (file.size / 1024 / 1024).toFixed(2)
      })
      res.status(413).send("File too large. Maximum size is 10MB.")
      return
    }

    // Check if floorplan_images table exists and has the location
    try {
      const existingLocation = await readDB(
        `SELECT location FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images WHERE location = ?`,
        [name],
        true
      )

      if (!existingLocation) {
        logger.warn(`[updateFloorplanImage:${requestId}] Location not found in floorplan_images table, creating entry`, {
          location: name,
          fileName: file.originalname
        })

        // Create new entry in floorplan_images table
        await writeDB(
          `INSERT INTO ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images (location, path) VALUES (?, ?)`,
          [name, file.filename]
        )
        
        logger.info(`[updateFloorplanImage:${requestId}] Created new floorplan_images entry`, {
          location: name,
          path: file.filename
        })
      } else {
        logger.info(`[updateFloorplanImage:${requestId}] Updating existing floorplan_images entry`, {
          location: name,
          oldPath: existingLocation.path,
          newPath: file.filename
        })

        // Update existing entry
        await writeDB(
          `UPDATE ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images SET path = ? WHERE location = ?`,
          [file.filename, name]
        )
      }

      const processingTime = Date.now() - startTime
      
      logger.info(`[updateFloorplanImage:${requestId}] Upload completed successfully`, {
        location: name,
        fileName: file.originalname,
        fileSize: file.size,
        processingTime: `${processingTime}ms`,
        filePath: file.filename,
        fullPath: file.path
      })

      res.status(200).json({
        message: "File uploaded and path updated successfully.",
        location: name,
        fileName: file.originalname,
        fileSize: file.size,
        processingTime: processingTime
      })

    } catch (dbError) {
      logger.error(`[updateFloorplanImage:${requestId}] Database error`, {
        location: name,
        fileName: file.originalname,
        error: dbError,
        errorMessage: dbError instanceof Error ? dbError.message : 'Unknown database error'
      })
      res.status(500).send("Database error occurred while updating image path.")
    }

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error(`[updateFloorplanImage:${requestId}] Unexpected error handling file upload`, {
      location: req.params.name,
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`
    })
    
    res.status(500).send("Could not upload image due to an unexpected error.")
  }
}
