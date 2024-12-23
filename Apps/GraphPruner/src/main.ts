import { readDB, writeDB } from "./db";
import cliProgress from 'cli-progress'

import {
  TARGET_CLOSENESS,
  ALWAYS_MERGE_CLOSENESS,
  Y_DIST_THRESHOLD,
  KEYFRAME_IMG_DIR,
  KEYFRAME_IMG_EXTENSION,
  OUTDOORS_LOCATION_NAME,
  OUTDOORS_TARGET_CLOSENESS,
  OUTDOORS_ALWAYS_MERGE_CLOSENESS,
  OUTDOORS_Y_DIST_THRESHOLD,
  QUERY_PREFIX,
  COORDS_TO_METRES,
} from "./consts";
import { calculateImageSharpness, calculateXZDistance, connectAllNeighboursIfNotAlready, convertTimestampToImagename, getNeighbours, getNextKeyframe, getNodeInfo, getNodePosition, getPhysicalProximityNeighbours, isNodeOutdoors, replaceNode } from './utils'
import { write } from "fs";

// TODO: Look at  'A New Trajectory Reduction Method for Mobile Devices Operating Both Online and Offline' paper


async function get_sharpness(sharpnessValues: any, ts: number, image_directory = KEYFRAME_IMG_DIR) {
  if (ts in sharpnessValues) {
    return sharpnessValues[ts]
  }
  const val = (await calculateImageSharpness(
    `${image_directory}${convertTimestampToImagename(ts)}`
  )) ?? 0;
  sharpnessValues[ts] = val;
  return val;
}

async function connectCloseTogetherPoints(horiztonal_dist = 1.5 / COORDS_TO_METRES) {
  let currentKeyframeId;
  let currentTs;

  const progBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

  const total_num = await readDB(`SELECT COUNT(*) as total FROM ${QUERY_PREFIX}nodes`, [], true)
  if (!total_num) throw new Error("Could not fetch node count");

  progBar.start(Number(total_num.total), 0)

  let firstFrame = await getNextKeyframe(-1);
  if (!firstFrame) return;

  console.log(firstFrame)

  currentKeyframeId = Number(firstFrame.keyframe_id);
  currentTs = Number(firstFrame.ts);
  if (isNaN(currentKeyframeId) || isNaN(currentTs)) {
    throw new Error("NULL keyframe ID - connectCloseTogetherPoints");

  }

  let count = 0;

  await writeDB("BEGIN TRANSACTION;")
  while (!isNaN(currentKeyframeId)) {
    progBar.increment()
    const neighbours = await getPhysicalProximityNeighbours(currentKeyframeId, horiztonal_dist)
    const result = await connectAllNeighboursIfNotAlready(currentKeyframeId, neighbours)

    count += result;

    firstFrame = await getNextKeyframe(currentKeyframeId);
    if (!firstFrame) break;

    currentKeyframeId = Number(firstFrame.keyframe_id);
    currentTs = Number(firstFrame.ts);

    if (isNaN(currentKeyframeId) || isNaN(currentTs)) {
      console.debug("Breaking on NaN: ", firstFrame)
      break;
    }
  }
  console.info("Wrote Edges: ", count)
  progBar.update(total_num.total)
  progBar.stop()
  await writeDB("COMMIT;")
}

/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * Use QuATR reduction (Quality Aware Two Ring Reduction) 
 * ring 1 - always connect proximity (connect UI issues)
 * ring 2 - ideal distance
 * beyond ring 2 - distance too large to remove
 */
async function useGreedyTripleRingStrategy(
  image_directory = KEYFRAME_IMG_DIR,
  extension = KEYFRAME_IMG_EXTENSION
) {

  const startTime = new Date().getTime()
  let sharpnessValues = {};
  const firstFrame = await getNextKeyframe(-1);
  if (!firstFrame) {
    throw new Error("Could not find the first frame!");
  }

  let currentKeyframeId = Number(firstFrame.keyframe_id);
  let currentTs = Number(firstFrame.ts);

  console.log("First keyframe ID", currentKeyframeId);

  let stack = [currentKeyframeId]
  let visited = new Set();

  let addToStack = (id: number) => {
    if (!visited.has(id)) stack.push(id)
  }

  // DFT every node
  while (stack.length > 0) {
    const currentKeyframeId = stack.pop()!
    if (visited.has(currentKeyframeId)) continue; // Sanity check we aren't adding duplicates
    visited.add(currentKeyframeId);

    console.log("Stack size: ", stack.length)
    console.time("Get Node Info")
    const node_info = await getNodeInfo(String(currentKeyframeId))
    currentTs = node_info["ts"]
    let currentPosition = node_info["position"]
    const isOutdoors = await isNodeOutdoors(currentKeyframeId)
    let is_current_deleted = false;
    console.timeEnd("Get Node Info")

    const currentSharpness = await get_sharpness(sharpnessValues, currentTs)
    console.log("Current:", currentKeyframeId);

    const checkedNeighbours = new Set();
    let neighboursHaveChanged = true;
    while (neighboursHaveChanged && !is_current_deleted) {

      console.time("Get Neighbours")
      const neighbours = await getNeighbours(currentKeyframeId, false);
      console.timeEnd("Get Neighbours")
      neighboursHaveChanged = false;

      for (const neighbour of neighbours) {
        const neighbourId = Number(neighbour.keyframe_id);
        const isNeighbourOutdoors = await isNodeOutdoors(neighbourId)
        if (currentKeyframeId == neighbourId) continue

        addToStack(neighbourId);

        if (checkedNeighbours.has(neighbourId)) continue;
        checkedNeighbours.add(neighbourId); // Not using 'visited' here, because we want the 'current' to delete a previous node if it was found sharper

        // 1. Horizontal Distance check
        const ts = neighbour.ts;
        const neighbourPosition = await getNodePosition(String(neighbourId));
        if (neighbourPosition == null) {
          throw new Error("Neighbour Position was null: ts: " + ts);
        }
        const distance = calculateXZDistance(
          currentPosition,
          neighbourPosition
        );
        if (distance == null) {
          throw new Error("Distance calculation was null between - Current: " + currentPosition + " & Neighbour: " + neighbourPosition);

        }

        // 2. Vertical distance check
        const yDistance = Math.abs(neighbourPosition[1] - currentPosition[1]);

        if (yDistance > (isOutdoors && isNeighbourOutdoors ? OUTDOORS_Y_DIST_THRESHOLD : Y_DIST_THRESHOLD)) {
          continue;
        }

        // 3. Check if inside the QuATR reduction's two rings
        if (distance < (isOutdoors && isNeighbourOutdoors ? OUTDOORS_TARGET_CLOSENESS : TARGET_CLOSENESS) || distance < (isOutdoors && isNeighbourOutdoors ? OUTDOORS_ALWAYS_MERGE_CLOSENESS : ALWAYS_MERGE_CLOSENESS)) {

          // 4. Calculate sharpness heuristic (note: this is the most costly step)
          console.time("Calc Sharpness")
          const neighbourSharpness = await get_sharpness(sharpnessValues, ts)
          console.timeEnd("Calc Sharpness");

          // 5. Remove the lowest sharpness
          if (neighbourSharpness <= currentSharpness) {
            console.log(
              "Deleting neighbour",
              neighbourId,
              "with sharpness",
              neighbourSharpness
            );

            console.time("Replace Node")
            if (await replaceNode(neighbourId, neighbourPosition, distance <= (isOutdoors && isNeighbourOutdoors ? OUTDOORS_ALWAYS_MERGE_CLOSENESS : ALWAYS_MERGE_CLOSENESS), isOutdoors && isNeighbourOutdoors)) {
              neighboursHaveChanged = true;
              visited.add(neighbourId); // Its been deleted, so don't try visit it
            }
            console.timeEnd("Replace Node")
          } else {
            // The next loop neighbour needs the current to still exist, so delete afterwards - continue to effectively remove all but the 'sharpest' neighbour, including the current point.
            if (is_current_deleted) continue;
            is_current_deleted = true;
          }
        }
      }
    }


    if (is_current_deleted) {
      const neighbours = await getNeighbours(currentKeyframeId)
      for (const neighbour of neighbours) {
        if (!checkedNeighbours.has(neighbour.keyframe_id)) addToStack(neighbour.keyframe_id)
      }
      console.log("Deleteing current node:", currentKeyframeId)
      console.time("Delete Node")
      await replaceNode(currentKeyframeId, currentPosition, false, isOutdoors);
      console.timeEnd("Delete Node")
    }
  }
  console.log("Finished in:", new Date().getTime() - startTime)
}



async function createAWorkingCopy() {
  const progBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)

  progBar.start(6, 0)

  await writeDB(`DROP TABLE IF EXISTS ${QUERY_PREFIX}edges;`);
  await writeDB(`DROP TABLE IF EXISTS ${QUERY_PREFIX}node_locations;`);
  await writeDB(`DROP TABLE IF EXISTS ${QUERY_PREFIX}nodes;`);
  await writeDB(`DROP TABLE IF EXISTS ${QUERY_PREFIX}special_labels;`);
  progBar.increment(1, { msg: "Dropping tables" })

  await writeDB(`
        CREATE TABLE ${QUERY_PREFIX}nodes (
            ts REAL NOT NULL,
            keyframe_id INTEGER PRIMARY KEY,
            pose BLOB NOT NULL,
            x_trans REAL,
            y_trans REAL,
            z_trans REAL,
            label TEXT DEFAULT NULL,
            zone TEXT DEFAULT NULL
        );`)
  progBar.increment(1, { msg: "Created working nodes table" })

  await writeDB(`
        CREATE TABLE ${QUERY_PREFIX}special_labels (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            label TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );`)
  progBar.increment(1, { msg: "Created working special_labels table" })

  await writeDB(`
        CREATE TABLE ${QUERY_PREFIX}edges (
            keyframe_id0 INTEGER NOT NULL,
            keyframe_id1 INTEGER NOT NULL,
            type INTEGER DEFAULT 2,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id0) REFERENCES nodes(keyframe_id),
            FOREIGN KEY (keyframe_id1) REFERENCES nodes(keyframe_id),
            UNIQUE(keyframe_id0, keyframe_id1),
            PRIMARY KEY (keyframe_id0, keyframe_id1)
        );`)
  progBar.increment(1, { msg: "Created working edges table" })

  await writeDB(`
        CREATE TABLE ${QUERY_PREFIX}node_locations (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            location TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );
    `)

  progBar.increment(1, { msg: "Created working node_locations table" })


  await writeDB(`INSERT INTO ${QUERY_PREFIX}nodes SELECT * FROM nodes;`);
  await writeDB(`INSERT INTO ${QUERY_PREFIX}node_locations SELECT * FROM node_locations;`);
  await writeDB(`INSERT INTO ${QUERY_PREFIX}edges SELECT * FROM edges;`);
  await writeDB(`INSERT INTO ${QUERY_PREFIX}special_labels SELECT * FROM special_labels;`);
  progBar.increment(1, { msg: "INSERT INTO tables completed" })
  progBar.stop()

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
