import express, { Router, Request, Response } from "express";
import { readDB, writeDB } from './db'
import path from "path";
import multer from "multer";
import bodyParser from 'body-parser'
import fs from 'fs'
import { disconnectNodes, connectNodes, replaceNode } from './utils'
import { SEND_TEST_IMAGE, FLOORPLAN_IMAGE_DIR, KEYFRAME_IMG_DIR, KEYFRAME_IMG_EXTENSION, ENABLE_AUTHORING_PAGE } from './consts'
const app = Router();

if (ENABLE_AUTHORING_PAGE) {
  app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }))

  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(express.static(path.join(__dirname, '../../authoring/dist')))

  app.get('/authoring', function (req, res) {
    res.sendFile(path.join(__dirname, '../../authoring/dist', 'index.html'))
  });

  // Configure Multer for file upload handling
  const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: (arg0: null, arg1: string) => void) => {
      // Ensure the uploads directory exists
      const uploadDir = FLOORPLAN_IMAGE_DIR;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }
      cb(null, uploadDir);
    },
    filename: (req: any, file: { originalname: any; }, cb: (arg0: null, arg1: any) => void) => {
      // Use the original filename
      cb(null, file.originalname);
    },
  });

  const upload = multer({ storage })

  app.post('/api/floorplans/:name/image', upload.single('file'), async (req: any, res) => {
    try {
      const { name } = req.params;
      const file = req.file;
      if (!file) {
        return res.status(400).send('No file uploaded.');
      }

      // Save the image path to the database
      const filePath = file.filename;
      await writeDB("UPDATE floorplan_images SET path = ? WHERE location = ?", [filePath, name]);

      res.send('File uploaded and path updated successfully.');
    } catch (error) {
      console.error('Error handling file upload:', error);
      res.status(500).send('Internal server error.');
    }
  });


  app.post('/api/floorplans/:name/updatemultiple', async (req: Request, res: Response) => {
    const { name } = req.params;
    const { points } = req.body;
    for (const point of points) {
      await writeDB("UPDATE floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;", [point.x, point.y, point.id, name]).then(
        (changes: number) => {
          if (changes == 0) {
            res.status(404).send("Could not find point to update")
            return;
          }
        }
      ).catch(() => {
        res.status(404).send("Error updating point")
        return;
      });
    }
    res.sendStatus(200);
  });


  app.post('/api/floorplans/:name/update', (req: Request, res: Response) => {
    const { name } = req.params;
    const { id, x, y } = req.body;

    writeDB("UPDATE floorplan_points SET x = ?, y = ? WHERE keyframe_id = ? AND location = ?;", [x, y, id, name]).then(
      (changes: number) => {
        if (changes > 0) {
          res.sendStatus(200)
        }
        else {
          res.status(404).send("Could not find point to update")
        }
      }
    ).catch(() => {
      res.status(404).send("Error updating point")
    });

  });


  app.post('/api/point/:id/label', async function (req, res) {
    let label = String(req.body.label)
    const id = Number(req.params.id)
    if (isNaN(id)) {
      res.status(400).send("ID must be valid!").end()
      return;
    }
    label = label.replace("<", "\<").replace(">", "\>"); // THIS AREA MAY BE VULNERABLE TO XSS - Only if the attacker gets ahold of the authoring panel, please disable it in consts once you are done authoring
    const changes = await writeDB("UPDATE refined_nodes SET label = ? WHERE keyframe_id = ?", [label, id])
    res.status(changes > 0 ? 200 : 409).send(changes > 0 ? "Point labelled" : "Error occurred - The point may be a border point, which cannot be deleted")
  })

  app.delete('/api/point/:id/delete', async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await replaceNode(Number(id))
    res.status(result ? 200 : 409).send(result ? "Point deleted" : "Error occurred - The point may be a border point, which cannot be deleted")
  })

  app.post('/api/point/:id1/connect/:id2', async (req: Request, res: Response) => {
    const { id1, id2 } = req.params;

    const is_on_same_level = await readDB("SELECT kf1.keyframe_id, kf2.keyframe_id, kf1.location FROM floorplan_points kf1 JOIN floorplan_points kf2 ON kf1.location = kf2.location AND kf1.keyframe_id <> kf2.keyframe_id AND kf1.keyframe_id = ? AND kf2.keyframe_id = ? LIMIT 1;", [id1, id2])
    if (is_on_same_level.length == 0) {
      res.status(409).send("Points are not on the same level!")
      return;
    }

    const result = await connectNodes(Number(id1), Number(id2));
    res.status(result ? 201 : 409).send(result ? "Points connected" : "Error occurred - The points may already be connected, or are border points!")
  })

  app.delete('/api/point/:id1/connect/:id2', async (req: Request, res: Response) => {
    const { id1, id2 } = req.params;

    const is_edge = await readDB("SELECT * FROM refined_edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?) LIMIT 1;", [id1, id2, id2, id1])
    if (is_edge.length == 0) {
      res.status(409).send("Points are not connected!")
      return;
    }

    const result = await disconnectNodes(Number(id1), Number(id2));
    res.status(result ? 201 : 409).send(result ? "Points connected" : "Error occurred - The points may already be disconnected, or are border points!")
  })
}

app.get('/api/floorplans/:name/image', async function (req: { params: { name: string } }, res) {
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

app.get('/api/floorplans/:name', async (req: Request, res: Response) => {
  const { name } = req.params;

  // Includes keyframes bordering the floor (add 'AND type < 50' to exclude)
  const pointResult = await readDB("SELECT f.keyframe_id, x, y, type, n.label FROM floorplan_points f JOIN refined_nodes n ON n.keyframe_id = f.keyframe_id WHERE location = ?", [name]);
  const image = await readDB("SELECT path FROM floorplan_images WHERE location = ? LIMIT 1;", [name])

  const edges = await readDB(`SELECT  e.keyframe_id0, e.keyframe_id1 FROM refined_edges e JOIN floorplan_points f ON e.keyframe_id0 = f.keyframe_id JOIN floorplan_points f2 ON e.keyframe_id1 = f2.keyframe_id WHERE f.location = ? AND f2.location = ?`, [name, name])
  if (pointResult.length && pointResult.length > 0 && image.length && image.length > 0) {
    res.json({ nodes: pointResult, has_image: image[0].path != '', image: image[0].path, edges: edges })
  } else {
    res.status(404).send('Floorplan not found');
  }
});

app.get('/api/floorplans', async (req: Request, res: Response) => {
  const floorplanResults = await readDB("SELECT DISTINCT location FROM floorplan_images;")
  res.json(floorplanResults.map((val: { location: string }) => val.location));
});

app.get('/api/image/:id', async function (req: { params: { id: number } }, res) {
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


export default app;