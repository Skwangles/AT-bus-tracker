import logger from "../logger"

export async function getGroupsFromPoints(border_nodes: [{ keyframe_id: number, id2: number, location: string, x_trans: number, z_trans: number }]): Promise<Array<{ keyframe_id: number, id2: number, location: string, x_trans: number, z_trans: number }>> {

  const lookup: { [key: number]: any } = {}
  for (const node of border_nodes) {
    const num = Number(node.keyframe_id)
    if (num in lookup) {
      lookup[num].push(node)
    }
    else {
      lookup[num] = [node]
    }
  }
  logger.verbose("Lookup Dictionary:")
  logger.verbose(JSON.stringify(lookup))
  let global_set = new Set<number>()
  const groups = []
  let response = findGroup(lookup, global_set)
  while (response.size > 0) {
    groups.push([...response])
    global_set = new Set([...global_set, ...response])
    response = findGroup(lookup, global_set)
  }

  return groups.map(v => lookup[v[0]][0])
}

function findGroup(lookup: any, global_visited: Set<number>): Set<number> {
  let firstItem = null
  for (const nodeId of Object.keys(lookup)) {
    if (global_visited.has(Number(nodeId))) continue
    firstItem = nodeId
  }
  if (firstItem == null) {
    return new Set()
  }


  const stack: Array<string | null> = [firstItem]
  const visited = new Set<number>()
  while (stack.length > 0) {
    logger.verbose(`[FindGroup] Stack size: ${stack.length}`)
    const itemId = stack.pop()
    const item = lookup[itemId!]
    if (!item || visited.has(item.keyframe_id)) {
      continue
    }
    visited.add(Number(itemId))

    for (const neighbour of item) {
      if (visited.has(Number(neighbour.keyframe_id))) {
        continue
      }
      stack.push(neighbour)
    }

  }
  return visited
}