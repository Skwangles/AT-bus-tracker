import path from 'path'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import initData from './initData'
import { FLOORPLAN_IMAGE_DIR, KEYFRAME_IMG_DIR, KEYFRAME_IMG_EXTENSION, QUERY_PREFIX, SEND_TEST_IMAGE, SKIP_IF_MAP_ALREADY_CONFIGED, USE_QUERY_PREFIX } from './consts'
import { searchNeighbour } from './neighbourSearch'
import { readDB } from './db'
import floorplanAPI from './authoring'
import { aStarPathfinding } from './pathfinding'
import { BlobArrayToMatrix } from './utils'
import sharp from 'sharp'



import type { Request, Response } from "express";

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// Define resolution levels with their dimensions
const RESOLUTION_LEVELS = {
  'preview': { width: 64, height: 32 },
  'lowest': { width: 256, height: 128 },
  'low': { width: 512, height: 256 },
  'medium': { width: 1024, height: 512 },
  'high': { width: 2048, height: 1024 },
  'ultra': { width: 4096, height: 2048 }
} as const;

type ResolutionLevel = keyof typeof RESOLUTION_LEVELS;

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

app.get('/api/v1/point/:id/path/:location', async function (req, res) {
  const point = Number(req.params.id)
  const locationCode = String(req.params.location)

  // Check label first, as these are manually annotated (and supposedly special) points
  let locationResults = await readDB(`SELECT s.keyframe_id FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}special_labels s WHERE s.label = ? LIMIT 1;`, [locationCode], true);
  let isLabel = true;
  if (!locationResults) {
    isLabel = false
    const firstPointWithLocation = (await readDB(`SELECT n.keyframe_id FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes n JOIN ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}node_locations nl ON n.keyframe_id = nl.keyframe_id WHERE nl.location = ? LIMIT 1;`, [locationCode], true));
    if (firstPointWithLocation.length === 0) {
      res.status(400).send("End location could not be found");
      return
    }
    locationResults = firstPointWithLocation
  }

  if ('keyframe_id' in locationResults) {
    res.json({ path: await aStarPathfinding(point, locationResults.keyframe_id, isLabel ? null : locationCode) ?? [] })
  }
  else {
    res.status(400).send("End location could not be found");
  }
});

app.get('/api/v1/point/:id/neighbours/:distance_thresh_m/:y_dist_thresh_m', async function (req, res) {
  const mainPointId = Number(req.params.id)

  const distanceThreshold = Number(req.params.distance_thresh_m);
  const yDistThresh = Number(req.params.y_dist_thresh_m);

  if (isNaN(mainPointId) || isNaN(distanceThreshold) || isNaN(yDistThresh)) {
    res.status(400).send("Invalid params").end();
    return;
  }

  // Fetch the initial point
  const currentPoint = await readDB(
    `SELECT x_trans, y_trans, z_trans FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes WHERE keyframe_id = ?`,
    [mainPointId], true
  );
  if (!currentPoint) {
    res.status(400).send("Point ID given does not exist!").end()
    return
  }

  res.json(await searchNeighbour(mainPointId, distanceThreshold, yDistThresh, currentPoint))
})




app.get('/api/v1/point/:id', async function (req: { params: { id: number } }, res) {
  const pointData = await readDB(`SELECT n.keyframe_id, n.ts, n.pose, l.location, n.x_trans, n.y_trans, n.z_trans FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes n LEFT JOIN ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE n.keyframe_id = ?;`, [Number(req.params.id)], true);
  console.log("Point Data: ", pointData)
  if (pointData && 'pose' in pointData) {
    console.log("Point: ", pointData);
    res.json({ ...pointData, pose: BlobArrayToMatrix(pointData.pose) })
  }
  else {
    res.status(400).send("Point ID given does not exist!").end()
  }
})

app.get('/api/v1/floors', async function (req: any, res: any) {
  res.json((await readDB(`SELECT DISTINCT l.location FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}node_locations l UNION SELECT DISTINCT label FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}special_labels s WHERE s.label is not NULL AND s.label <> '';`)))
  // Some labels and floor names may be vulnerable to XSS
})


app.get('/api/v1/floor/:floor/point/', async function (req: any, res: any) {
  console.log("Hit floor endpoint")
  // Get FIRST node which has that location
  const nodeWithSpecialLabel = await readDB(`SELECT n.keyframe_id, pose, x_trans, y_trans, z_trans FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes n JOIN ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}special_labels s ON s.keyframe_id = n.keyframe_id WHERE s.label = ?`, [req.params.floor])

  if (nodeWithSpecialLabel.length != 0) {
    console.log("Found a label", nodeWithSpecialLabel)
    res.json(nodeWithSpecialLabel[0])
    return;
  }
  const firstNodeWithLocation = await readDB(`SELECT n.keyframe_id, l.location FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes n JOIN ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}node_locations l ON n.keyframe_id = l.keyframe_id WHERE l.location = ? LIMIT 1`, [req.params.floor])
  if (firstNodeWithLocation.length > 0) {
    console.log("Returning rows")
    res.json(firstNodeWithLocation[0])
  }
  else {
    console.log("Could not find")
    res.status(404).send("Could not find any nodes with that location").end();
  }
})

app.get('/api/v1/image/:resolution/:ts', async function (req: { params: { ts: string, resolution: string } }, res) {
  const ts = Number(req.params.ts).toFixed(5);
  if (ts === "NaN") {
    res.status(400).send("Image id was not a valid image ID")
    return;
  }

  const resolution = req.params.resolution as ResolutionLevel;
  if (!(resolution in RESOLUTION_LEVELS)) {
    res.status(400).send("Invalid resolution level. Must be one of: " + Object.keys(RESOLUTION_LEVELS).join(", "));
    return;
  }

  if (SEND_TEST_IMAGE) {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
    return;
  }

  const imgPath = path.join(KEYFRAME_IMG_DIR, ts + KEYFRAME_IMG_EXTENSION)
  if (!fs.existsSync(imgPath)) {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
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
    console.error('Error processing image:', error)
    res.status(500).send('Error processing image')
  }
})


app.get('/api/v1/floorplans/:name/image', async function (req: { params: { name: string } }, res) {
  const name = String(req.params.name);

  // Using FROM nodes because its the superset
  const result = await readDB("SELECT path FROM floorplan_images WHERE location = ?", [name])
  if (!result || result.length == 0) {
    res.sendStatus(404);
    return;
  }


  const pathString = path.join(FLOORPLAN_IMAGE_DIR, String(result[0].path));
  if (!pathString) {
    res.sendStatus(404); // Potential directory traversal attack found
    return;
  }
  if (fs.existsSync(pathString)) {
    res.sendFile(pathString)
  }
  else {
    res.sendStatus(404);
  }
})

app.get('/api/v1/floorplans/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const pointResult = await readDB(`SELECT f.keyframe_id, x, y, type FROM floorplan_points f JOIN ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}nodes n ON n.keyframe_id = f.keyframe_id WHERE location = ?`, [name]);
  const image = await readDB("SELECT path FROM floorplan_images WHERE location = ? LIMIT 1;", [name])

  const edges = await readDB(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM ${USE_QUERY_PREFIX ? QUERY_PREFIX : ""}edges e JOIN floorplan_points f ON e.keyframe_id0 = f.keyframe_id JOIN floorplan_points f2 ON e.keyframe_id1 = f2.keyframe_id WHERE f.location = ? AND f2.location = ?`, [name, name])
  if (pointResult.length && pointResult.length > 0 && image.length && image.length > 0) {
    res.json({ nodes: pointResult, has_image: image[0].path != '', image: image[0].path, edges: edges })
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.get('/api/v1/floorplans', async (req: Request, res: Response) => {
  const floorplanResults = await readDB("SELECT DISTINCT location FROM floorplan_images;")
  res.json(floorplanResults.map((val: { location: string }) => val.location));
});

app.get('/api/v1/image/:id', async function (req: { params: { id: number } }, res) {
  const id = Number(req.params.id);

  // Using FROM nodes because its the superset
  const result = await readDB("SELECT ts FROM nodes WHERE keyframe_id = ?", [id])
  if (!result || result.length == 0) {
    res.sendStatus(404);
    return;
  }

  const ts = Number(result[0].ts).toFixed(5);
  if (ts === "NaN") {
    res.status(400).send("Image id was not a valid image ID")
    return;
  }

  if (SEND_TEST_IMAGE) {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"));
    console.log("Sending Test")
    return;
  }
  const pathString = path.join(KEYFRAME_IMG_DIR, Number(ts).toFixed(5).toString() + KEYFRAME_IMG_EXTENSION);
  if (!pathString) {
    res.sendStatus(404);
    return; // Potential directory traversal attack
  }

  if (fs.existsSync(pathString)) {
    res.sendFile(pathString)
  }
  else {
    res.sendFile(path.join(KEYFRAME_IMG_DIR, "test.jpg"))
  }
})

app.use(floorplanAPI)

const port = 3001
app.listen(port, () => {
  initData(SKIP_IF_MAP_ALREADY_CONFIGED)
  console.log(`Server running on port ${port}`)
})
