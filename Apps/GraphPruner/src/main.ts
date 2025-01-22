import { initDB, readDB, writeDB } from "./db";
import cliProgress from "cli-progress";
import fs from 'node:fs'
import {
  DFLT_TARGET_CLOSENESS,
  DFLT_ALWAYS_MERGE_CLOSENESS,
  DFLT_Y_DIST_THRESHOLD,
  DFLT_KEYFRAME_IMG_DIR,
  DFLT_KEYFRAME_IMG_EXTENSION,
  DFLT_OUTDOORS_LOCATION_NAME,
  DFLT_OUTDOORS_TARGET_CLOSENESS,
  DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS,
  DFLT_OUTDOORS_Y_DIST_THRESHOLD,
  DFLT_TABLE_PREFIX,
  DFLT_COORDS_TO_METRES,
  NodeInfo,
  Config,
  DFLT_PREPROCESSED_IMG_SHARPNESS_JSON,
  DFLT_SQLITE_DB_PATH,
} from "./consts";

import {
  calculateImageSharpness,
  calculateXZDistance,
  connectAllNeighboursIfNotAlready,
  convertTimestampToImagename,
  getNeighbours,
  getNextKeyframe,
  getNodeInfo,
  getNodePosition,
  getNumberOfNodes,
  getPhysicalProximityNeighbours,
  isNodeOutdoors,
  replaceNode,
} from "./utils";
import { useGreedyTripleRingStrategy } from "./strategy";

const args = require("yargs").argv;
if (args.h) {

  console.log(
    `
    --table_prefix=${DFLT_TABLE_PREFIX}
    --coords_to_metres=${DFLT_COORDS_TO_METRES}
    --outer_ring=${DFLT_TARGET_CLOSENESS}
    --inner_ring=${DFLT_ALWAYS_MERGE_CLOSENESS}
    --otdr_outer_ring=${DFLT_OUTDOORS_TARGET_CLOSENESS}
    --otdr_inner_ring=${DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS}
    --img_dir=${DFLT_KEYFRAME_IMG_DIR}
    --img_ext=${DFLT_KEYFRAME_IMG_EXTENSION}
    --y_dist_thresh=${DFLT_Y_DIST_THRESHOLD}
    --otdr_y_dist_thresh=${DFLT_OUTDOORS_Y_DIST_THRESHOLD}
    --preproc_sharpness_json=${DFLT_PREPROCESSED_IMG_SHARPNESS_JSON}
    `
  )
  process.exit(0)
}

const SQLITE_DB = args.db ?? DFLT_SQLITE_DB_PATH
const IMG_DIR = args.img_dir ?? DFLT_KEYFRAME_IMG_DIR;
const IMG_EXT = args.img_ext ?? DFLT_KEYFRAME_IMG_EXTENSION;
const OUTER_RING = args.outer_prox ?? DFLT_TARGET_CLOSENESS;
const INNER_RING = args.inner_prox ?? DFLT_ALWAYS_MERGE_CLOSENESS;
const OTDR_OUTER_RING =
  args.outdoor_outer_prox ?? DFLT_OUTDOORS_TARGET_CLOSENESS;
const OTDR_INNER_RING =
  args.outdoor_inner_prox ?? DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS;
const Y_DIST = args.y_dist ?? DFLT_Y_DIST_THRESHOLD;
const OTDR_Y_DIST = args.outdoor_y_dist ?? DFLT_OUTDOORS_Y_DIST_THRESHOLD;
const TABLE_PREFIX = args.table_prefix ?? DFLT_TABLE_PREFIX;
const CONVERSION_CRD2MTR = args.coords_to_metres ?? DFLT_COORDS_TO_METRES;
const PREPROC_SHARPNESS_JSON = args.preproc_sharpness_json ?? DFLT_PREPROCESSED_IMG_SHARPNESS_JSON

const config: Config = {
  table_prefix: TABLE_PREFIX,
  coords_to_metres: CONVERSION_CRD2MTR,
  outer_ring: OUTER_RING,
  inner_ring: INNER_RING,
  otdr_outer_ring: OTDR_OUTER_RING,
  otdr_inner_ring: OTDR_INNER_RING,
  img_dir: IMG_DIR,
  img_ext: IMG_EXT,
  y_dist_thresh: Y_DIST,
  otdr_y_dist_thresh: OTDR_Y_DIST,
  preproc_sharpness_json: PREPROC_SHARPNESS_JSON
}
console.info("Args:", config)


async function connectCloseTogetherPoints(
  horiztonal_dist = INNER_RING / CONVERSION_CRD2MTR,
  vert_dist = Y_DIST / CONVERSION_CRD2MTR
) {
  let currentKeyframeId;
  let currentTs;

  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );

  const total_num = await readDB(
    `SELECT COUNT(*) as total FROM ${config.table_prefix}nodes`,
    [],
    true
  );
  console.log(total_num);
  if (!total_num) throw new Error("Could not fetch node count");

  progBar.start(Number(total_num.total), 0);

  let firstFrame = await getNextKeyframe(config, -1);
  if (!firstFrame) return;

  console.log(firstFrame);

  currentKeyframeId = Number(firstFrame.keyframe_id);
  currentTs = Number(firstFrame.ts);
  if (isNaN(currentKeyframeId) || isNaN(currentTs)) {
    throw new Error("NULL keyframe ID - connectCloseTogetherPoints");
  }

  let count = 0;

  await writeDB("BEGIN TRANSACTION;");
  while (!isNaN(currentKeyframeId)) {
    progBar.increment();
    const neighbours = await getPhysicalProximityNeighbours(
      config,
      currentKeyframeId,
      horiztonal_dist,
      vert_dist
    );
    const result = await connectAllNeighboursIfNotAlready(
      config,
      currentKeyframeId,
      neighbours
    );

    count += result;

    firstFrame = await getNextKeyframe(config, currentKeyframeId);
    if (!firstFrame) break;

    currentKeyframeId = Number(firstFrame.keyframe_id);
    currentTs = Number(firstFrame.ts);

    if (isNaN(currentKeyframeId) || isNaN(currentTs)) {
      console.debug("Breaking on NaN: ", firstFrame);
      break;
    }
  }
  console.info("Wrote Edges: ", count);
  progBar.update(total_num.total);
  progBar.stop();
  await writeDB("COMMIT;");
}



async function createAWorkingCopy() {
  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );

  progBar.start(6, 0);

  await writeDB(`DROP TABLE IF EXISTS ${config.table_prefix}edges;`);
  await writeDB(`DROP TABLE IF EXISTS ${config.table_prefix}node_locations;`);
  await writeDB(`DROP TABLE IF EXISTS ${config.table_prefix}nodes;`);
  await writeDB(`DROP TABLE IF EXISTS ${config.table_prefix}special_labels;`);
  progBar.increment(1, { msg: "Dropping tables" });

  await writeDB(`
        CREATE TABLE ${config.table_prefix}nodes (
            ts REAL NOT NULL,
            keyframe_id INTEGER PRIMARY KEY,
            pose BLOB NOT NULL,
            x_trans REAL,
            y_trans REAL,
            z_trans REAL,
            zone TEXT DEFAULT NULL
        );`);
  progBar.increment(1, { msg: "Created working nodes table" });

  await writeDB(`
        CREATE TABLE ${config.table_prefix}special_labels (
            keyframe_id INTEGER NOT NULL,
            label TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id),
            PRIMARY KEY (label, keyframe_id)
        );`);
  progBar.increment(1, { msg: "Created working special_labels table" });

  await writeDB(`
        CREATE TABLE ${config.table_prefix}edges (
            keyframe_id0 INTEGER NOT NULL,
            keyframe_id1 INTEGER NOT NULL,
            type INTEGER DEFAULT 2,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id0) REFERENCES nodes(keyframe_id),
            FOREIGN KEY (keyframe_id1) REFERENCES nodes(keyframe_id),
            UNIQUE(keyframe_id0, keyframe_id1),
            PRIMARY KEY (keyframe_id0, keyframe_id1)
        );`);
  progBar.increment(1, { msg: "Created working edges table" });

  await writeDB(`
        CREATE TABLE ${config.table_prefix}node_locations (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            location TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );
    `);

  progBar.increment(1, { msg: "Created working node_locations table" });

  await writeDB(
    `INSERT INTO ${config.table_prefix}nodes SELECT ts, keyframe_id, pose, x_trans, y_trans, z_trans, zone FROM nodes;`
  );
  await writeDB(
    `INSERT INTO ${config.table_prefix}node_locations SELECT * FROM node_locations;`
  );
  await writeDB(`INSERT INTO ${config.table_prefix}edges SELECT * FROM edges;`);
  await writeDB(
    `INSERT INTO ${config.table_prefix}special_labels SELECT * FROM special_labels;`
  );
  progBar.increment(1, { msg: "INSERT INTO tables completed" });
  progBar.stop();
}

// Main function to prune nodes
async function prune() {
  await createAWorkingCopy();
  await connectCloseTogetherPoints();


  const sharpness_values = JSON.parse(fs.readFileSync(config.preproc_sharpness_json, 'utf8'));
  config["sharpness"] = sharpness_values
  console.log("Copied across nodes, edges and node_locations");
  try {

    await useGreedyTripleRingStrategy(config);

    console.log("Committing");
  } catch (e) {
    console.log("Error:", e);
    await writeDB("ROLLBACK");
  } finally {
  }
}

initDB(SQLITE_DB)
prune().catch(console.error);
