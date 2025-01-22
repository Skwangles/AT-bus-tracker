import { config } from "process";
import { Config, NodeInfo } from "./consts";
import { calculateImageSharpness, calculateXZDistance, convertTimestampToImagename, getNeighbours, getNextKeyframe, getNodeInfo, getNumberOfNodes, isNodeOutdoors, replaceNode } from "./utils";
import cliProgress from 'cli-progress'
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

function canRemovePoint(id: number, node_info: NodeInfo): boolean {
  const hasSpecialPointInfo = node_info.label_count > 0;
  return !hasSpecialPointInfo;
}

async function get_sharpness(
  config: Config,
  ts: number
) {
  if (isNaN(Number(ts)))
    throw new Error("NaN timestamp passed to get_sharpness");
  const fullImageName = convertTimestampToImagename(config, ts).trim()

  // Check Preproccessed values
  if (config['sharpness'] && config['sharpness'][fullImageName]) {
    return config['sharpness']['']
  }
  else if (!config['sharpness']) {
    config['sharpness'] = {}
  }

  const val =
    (await calculateImageSharpness(
      `${config.img_dir}${fullImageName}`
    )) ?? 0;
  config['sharpness'][fullImageName] = val;
  return val;
}

/**
 * Loop through each node, if a node is within 5m keep the least blurry
 * Use QuATR reduction (Quality Aware Two Ring Reduction)
 * ring 1 - always connect proximity (connect UI issues)
 * ring 2 - ideal distance
 * beyond ring 2 - distance too large to remove
 */
export async function useGreedyTripleRingStrategy(
  config: Config
) {
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  const nodeCount = await getNumberOfNodes();
  bar.start(nodeCount.total, 0);

  const startTime = new Date().getTime();
  const firstFrame = await getNextKeyframe(config, -1);
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
    const node_info = await getNodeInfo(config, String(currentNodeId));
    if (!node_info) throw new Error("Node does not exist: " + currentNodeId);
    currentTs = Number(node_info["ts"]);
    let currentPosition = node_info["position"];
    let currentNodeInfo = node_info;
    let canRemoveCurrentNode = canRemovePoint(currentNodeId, currentNodeInfo);
    const isOutdoors = await isNodeOutdoors(config, currentNodeId);
    let is_current_deleted = false;
    console.timeEnd("Get Node Info");

    const currentSharpness = await get_sharpness(config, currentTs);
    console.log("Current:", currentNodeId);

    const checkedNeighbours = new Set();
    let neighboursHaveChanged = true;

    // Previous loops may create new direct neighbours, make sure they are all checked
    while (neighboursHaveChanged && !is_current_deleted) {
      console.time("Get Neighbours");
      const neighbours = await getNeighbours(config, currentNodeId, false);
      console.timeEnd("Get Neighbours");
      neighboursHaveChanged = false;

      for (const neighbour of neighbours) {
        const neighbourId = Number(neighbour.keyframe_id);

        const isNeighbourOutdoors = await isNodeOutdoors(config, neighbourId);
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
        const neighbourInfo = await getNodeInfo(config, String(neighbourId));
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

        if (yDistance > (useOutdoors ? config.otdr_y_dist_thresh : config.y_dist_thresh)) {
          continue;
        }

        // 3. Check if inside the QuATR reduction's two rings
        if (
          distance < (useOutdoors ? config.otdr_outer_ring : config.outer_ring) ||
          distance < (useOutdoors ? config.otdr_inner_ring : config.inner_ring)
        ) {
          // 4. Calculate sharpness heuristic (note: this is the most costly step)
          console.time("Calc Sharpness");
          const neighbourSharpness = await get_sharpness(config, ts);
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
                config,
                neighbourId,
                neighbourPosition,
                distance <= (useOutdoors ? config.otdr_inner_ring : config.inner_ring),
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
      const neighbours = await getNeighbours(config, currentNodeId);
      for (const neighbour of neighbours) {
        if (!checkedNeighbours.has(neighbour.keyframe_id))
          addToStack(neighbour.keyframe_id);
      }
      console.log("Deleting current node:", currentNodeId);
      console.time("Delete Node");
      await replaceNode(config, currentNodeId, currentPosition, false, isOutdoors);
      console.timeEnd("Delete Node");
    }
  }
  bar.stop();
  console.log("Finished in:", new Date().getTime() - startTime);
}