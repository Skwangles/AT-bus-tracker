import { Request, Response } from "express";
import path from "path";
import sharp from "sharp";
import { SEND_TEST_IMAGE, KEYFRAME_IMG_DIR, KEYFRAME_IMG_EXTENSION, REASONABLE_MAX_STRING_SIZE, FLOORPLAN_IMG_DIR, USE_TABLE_PREFIX, TABLE_PREFIX } from "../consts";
import fs from "fs"
import { readDB, writeDB } from "../db";
import multer from "multer";
import logger from "../logger";

const RESOLUTION_LEVELS = {
  // Aspect ratio of Equirectangular images is 2:1
  'preview': { width: 64, height: 32 },
  'lowest': { width: 256, height: 128 },
  'low': { width: 512, height: 256 },
  'medium': { width: 1024, height: 512 },
  'high': { width: 2048, height: 1024 },
  'ultra': { width: 4096, height: 2048 }
} as const;

type ResolutionLevel = keyof typeof RESOLUTION_LEVELS;



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


export async function getImageByTs(req: Request, res: Response): Promise<void> {
  const ts = Number(req.params.ts);
  if (isNaN(ts)) {
    logger.warn(`[getImageByTs] invalid ts (note, may be called via getImgbyId):${ts}`)
    res.status(400).send("Invalid Arguments")
    return;
  }

  const resolution = req.params.resolution as ResolutionLevel;
  if (!(resolution in RESOLUTION_LEVELS)) {
    logger.warn(`[getImageByTs] invalid res (note, may be called via getImgbyId): ${res}not in: ${Object.keys(RESOLUTION_LEVELS).join(", ")}`)
    res.status(400).send("Invalid Arguments");
    return;
  }

  if (SEND_TEST_IMAGE) {
    logger.debug(`[getImageByTs] Sending test image enabled!`)
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
    return;
  }

  const imgPath = path.join(KEYFRAME_IMG_DIR, ts.toFixed(5) + KEYFRAME_IMG_EXTENSION)
  if (!fs.existsSync(imgPath)) {
    logger.error(`[getImageByTs] Cannot find image file: ${imgPath}`)
    res.status(404).send("Image does not exist").end()
    return;
  }

  try {
    const { width, height } = RESOLUTION_LEVELS[resolution];

    // Process and send the image at the requested resolution
    const image = sharp(imgPath)
      .resize(width, height, {
        fit: 'fill',
        withoutEnlargement: true
      })
      .jpeg({ quality: resolution === 'preview' ? 60 : 85 })

    res.set('Content-Type', 'image/png')
    image.pipe(res)
  } catch (error) {
    logger.error(`[getImageByTs] Internal error - Error processing image: ${error}`)
    res.status(500).send('Could not process image, please try again later')
  }
}



export async function getImageById(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    logger.warn(`[GetImageById] invalid ID argument: ${id}`)
    res.status(400).send("Invalid Arguments")
    return
  }

  const result = await readDB(`SELECT ts FROM ${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}nodes WHERE keyframe_id = ? LIMIT 1`, [id], true)
  if (!result) {
    logger.warn(`[GetImageById] - Could not find node with id: ${id}`)
    res.status(404).send("Invalid Arguments");
    return;
  }

  const ts = Number(result.ts).toFixed(5);
  if (isNaN(Number(result.ts))) {
    logger.warn(`[GetImageById] Invalid Timestamp from TS: ${ts} from id: ${id}`)
    res.status(400).send("Invalid Arguments")
    return;
  }

  req.params.ts = ts;
  await getImageByTs(req, res)
}

export async function updateFloorplanImage(req: Request, res: Response) {
  try {
    const { name } = req.params;
    const file = req.file;
    if (!file) {
      logger.error(`[updateFloorplanImage] no image provided for name: ${name}`)
      res.status(400).send("No file uploaded.");
      return
    }

    // Save the image path to the database
    const filePath = file.filename;
    await writeDB(
      "UPDATE floorplan_images SET path = ? WHERE location = ?",
      [filePath, name]
    );

    res.send("File uploaded and path updated successfully.");
  } catch (error) {
    logger.error(`[updateFloorplanImage] Error handling file upload: ${error}`);
    res.status(500).send("Could not upload image");
  }
}