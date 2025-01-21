import { readDB, writeDB } from "./db";
import cliProgress from "cli-progress";

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

const args = require("yargs").argv;
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

function canRemovePoint(id: number, node_info: NodeInfo): boolean {
  const hasSpecialPointInfo = node_info.label_count > 0;
  return !hasSpecialPointInfo;
}

async function get_sharpness(
  sharpnessValues: any,
  ts: number,
  image_directory = IMG_DIR
) {
  if (isNaN(Number(ts)))
    throw new Error("NaN timestamp passed to get_sharpness");
  if (ts in sharpnessValues) {
    return sharpnessValues[ts];
  }
  const val =
    (await calculateImageSharpness(
      `${image_directory}${convertTimestampToImagename(ts)}`
    )) ?? 0;
  sharpnessValues[ts] = val;
  return val;
}

async function connectCloseTogetherPoints(
  horiztonal_dist = 1.5 / CONVERSION_CRD2MTR
) {
  let currentKeyframeId;
  let currentTs;

  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );

  const total_num = await readDB(
    `SELECT COUNT(*) as total FROM ${TABLE_PREFIX}nodes`,
    [],
    true
  );
  console.log(total_num);
  if (!total_num) throw new Error("Could not fetch node count");

  progBar.start(Number(total_num.total), 0);

  let firstFrame = await getNextKeyframe(-1);
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
      currentKeyframeId,
      horiztonal_dist
    );
    const result = await connectAllNeighboursIfNotAlready(
      currentKeyframeId,
      neighbours
    );

    count += result;

    firstFrame = await getNextKeyframe(currentKeyframeId);
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

/**
 *
 * @param isCurrentNodeOutdoor
 * @param isNeighbourNodeOutdoor
 * @returns
 */
function useOutdoorProximities(
  isCurrentNodeOutdoor: boolean,
  isNeighbourNodeOutdoor: boolean
) {
  return isCurrentNodeOutdoor && isNeighbourNodeOutdoor;
}

/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * Use QuATR reduction (Quality Aware Two Ring Reduction)
 * ring 1 - always connect proximity (connect UI issues)
 * ring 2 - ideal distance
 * beyond ring 2 - distance too large to remove
 */
async function useGreedyTripleRingStrategy(
  image_directory = IMG_DIR,
  extension = IMG_EXT
) {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const nodeCount = await getNumberOfNodes();
  bar.start(nodeCount.total, 0);

  const startTime = new Date().getTime();
  let sharpnessValues = {};
  const firstFrame = await getNextKeyframe(-1);
  if (!firstFrame) {
    throw new Error("Could not find the first frame!");
  }

  let currentKeyframeId = Number(firstFrame.keyframe_id);
  let currentTs = Number(firstFrame.ts);

  console.log("First keyframe ID", currentKeyframeId);

  let stack = [currentKeyframeId];
  let visited = new Set();

  let addToStack = (id: number) => {
    if (!visited.has(id)) stack.push(id);
  };

  // DFT every node
  while (stack.length > 0) {
    bar.update(visited.size);
    const currentNodeId = stack.pop()!;
    if (visited.has(currentNodeId)) continue; // Sanity check we aren't adding duplicates
    visited.add(currentNodeId);

    console.log("Stack size: ", stack.length);
    console.time("Get Node Info");
    const node_info = await getNodeInfo(String(currentNodeId));
    if (!node_info) throw new Error("Node does not exist: " + currentNodeId);
    currentTs = Number(node_info["ts"]);
    let currentPosition = node_info["position"];
    let currentNodeInfo = node_info;
    let canRemoveCurrentNode = canRemovePoint(currentNodeId, currentNodeInfo);
    const isOutdoors = await isNodeOutdoors(currentNodeId);
    let is_current_deleted = false;
    console.timeEnd("Get Node Info");

    const currentSharpness = await get_sharpness(sharpnessValues, currentTs);
    console.log("Current:", currentNodeId);

    const checkedNeighbours = new Set();
    let neighboursHaveChanged = true;

    // Previous loops may create new direct neighbours, make sure they are all checked
    while (neighboursHaveChanged && !is_current_deleted) {
      console.time("Get Neighbours");
      const neighbours = await getNeighbours(currentNodeId, false);
      console.timeEnd("Get Neighbours");
      neighboursHaveChanged = false;

      for (const neighbour of neighbours) {
        const neighbourId = Number(neighbour.keyframe_id);

        const isNeighbourOutdoors = await isNodeOutdoors(neighbourId);
        if (currentNodeId == neighbourId) continue;

        const useOutdoors = useOutdoorProximities(
          isOutdoors,
          isNeighbourOutdoors
        );

        addToStack(neighbourId);

        // Not adding to 'visited' here, because we want the 'current' to delete a previous node if it was found sharper
        if (checkedNeighbours.has(neighbourId)) continue;
        checkedNeighbours.add(neighbourId); //

        // 1. Horizontal Distance check
        const neighbourInfo = await getNodeInfo(String(neighbourId));
        if (!neighbourInfo)
          throw new Error("Cannot find Neighbour node ID: " + neighbourId);

        const ts = Number(neighbourInfo.ts);
        const neighbourPosition = neighbourInfo.position;
        if (neighbourPosition == null) {
          throw new Error("Neighbour Position was null: ts: " + ts);
        }

        const distance = calculateXZDistance(
          currentPosition,
          neighbourPosition
        );
        if (distance == null) {
          throw new Error(
            "Distance calculation was null between - Current: " +
              currentPosition +
              " & Neighbour: " +
              neighbourPosition
          );
        }

        // 2. Vertical distance check
        const yDistance = Math.abs(neighbourPosition[1] - currentPosition[1]);

        if (yDistance > (useOutdoors ? OTDR_Y_DIST : Y_DIST)) {
          continue;
        }

        // 3. Check if inside the QuATR reduction's two rings
        if (
          distance < (useOutdoors ? OTDR_OUTER_RING : OUTER_RING) ||
          distance < (useOutdoors ? OTDR_INNER_RING : INNER_RING)
        ) {
          // 4. Calculate sharpness heuristic (note: this is the most costly step)
          console.time("Calc Sharpness");
          const neighbourSharpness = await get_sharpness(sharpnessValues, ts);
          console.timeEnd("Calc Sharpness");

          // 5. Remove the lowest sharpness
          if (
            canRemovePoint(neighbourId, neighbourInfo) &&
            (neighbourSharpness <= currentSharpness || !canRemoveCurrentNode)
          ) {
            console.log(
              "Deleting neighbour",
              neighbourId,
              "with sharpness",
              neighbourSharpness
            );

            console.time("Replace Node");
            if (
              await replaceNode(
                neighbourId,
                neighbourPosition,
                distance <= (useOutdoors ? OTDR_INNER_RING : INNER_RING),
                useOutdoors
              )
            ) {
              neighboursHaveChanged = true;
              visited.add(neighbourId); // Its been deleted, so don't try visit it
            }
            console.timeEnd("Replace Node");
          } else if (canRemoveCurrentNode) {
            // The next loop neighbour needs the current to still exist, so delete afterwards - continue to effectively remove all but the 'sharpest' neighbour, including the current point.
            if (is_current_deleted) continue;
            is_current_deleted = true;
          }
        }
      }
    }

    if (is_current_deleted) {
      const neighbours = await getNeighbours(currentNodeId);
      for (const neighbour of neighbours) {
        if (!checkedNeighbours.has(neighbour.keyframe_id))
          addToStack(neighbour.keyframe_id);
      }
      console.log("Deleteing current node:", currentNodeId);
      console.time("Delete Node");
      await replaceNode(currentNodeId, currentPosition, false, isOutdoors);
      console.timeEnd("Delete Node");
    }
  }
  bar.stop();
  console.log("Finished in:", new Date().getTime() - startTime);
}

async function createAWorkingCopy() {
  const progBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );

  progBar.start(6, 0);

  await writeDB(`DROP TABLE IF EXISTS ${TABLE_PREFIX}edges;`);
  await writeDB(`DROP TABLE IF EXISTS ${TABLE_PREFIX}node_locations;`);
  await writeDB(`DROP TABLE IF EXISTS ${TABLE_PREFIX}nodes;`);
  await writeDB(`DROP TABLE IF EXISTS ${TABLE_PREFIX}special_labels;`);
  progBar.increment(1, { msg: "Dropping tables" });

  await writeDB(`
        CREATE TABLE ${TABLE_PREFIX}nodes (
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
        CREATE TABLE ${TABLE_PREFIX}special_labels (
            keyframe_id INTEGER NOT NULL,
            label TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id),
            PRIMARY KEY (label, keyframe_id)
        );`);
  progBar.increment(1, { msg: "Created working special_labels table" });

  await writeDB(`
        CREATE TABLE ${TABLE_PREFIX}edges (
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
        CREATE TABLE ${TABLE_PREFIX}node_locations (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            location TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );
    `);

  progBar.increment(1, { msg: "Created working node_locations table" });

  await writeDB(
    `INSERT INTO ${TABLE_PREFIX}nodes SELECT ts, keyframe_id, pose, x_trans, y_trans, z_trans, zone FROM nodes;`
  );
  await writeDB(
    `INSERT INTO ${TABLE_PREFIX}node_locations SELECT * FROM node_locations;`
  );
  await writeDB(`INSERT INTO ${TABLE_PREFIX}edges SELECT * FROM edges;`);
  await writeDB(
    `INSERT INTO ${TABLE_PREFIX}special_labels SELECT * FROM special_labels;`
  );
  progBar.increment(1, { msg: "INSERT INTO tables completed" });
  progBar.stop();
}

// Main function to prune nodes
async function prune() {
  await createAWorkingCopy();
  await connectCloseTogetherPoints();
  console.log("Copied across nodes, edges and node_locations");
  try {
    await useGreedyTripleRingStrategy();

    console.log("Committing");
  } catch (e) {
    console.log("Error:", e);
    await writeDB("ROLLBACK");
  } finally {
  }
}

prune().catch(console.error);
