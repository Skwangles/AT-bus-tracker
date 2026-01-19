from db_manager import DatabaseManager
import numpy as np
from tqdm import tqdm
import time
MAX_DEPTH = 2 # only checks traversing via one other node

class TransitiveReducer:
    """
    Transitive reduction strategy for spatial graphs.

    This module implements a transitive reduction strategy where edges are removed
    if they are implied by other edges in the graph.

    The simple agorithm looks for all edges of a node, doing the longest edge first, so that it easily removes the biggest and ugliest edges first.
    Also, by doing this it effectively just prunes the edges for us.

    Note: It is important that we include ALL types of edges, including covisibility edges, as often the pruning and future stages consider the covisibility edges for navigation -> potentially this might be better suited in the initData to get a simplified graph.
    """

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.dp_cache = {}

    # This method will get the list of nodes and get the length of each of the nodes neighbours and the length of each of the edges (x, y, z of current ndoe and the x, y, z of the neighbour)
    # Order the edges by length, then from the longest to shortest edge, 
    # check if the same node can be reached within two jumps via another node, if so, delete the longer edge.
    def reduce_transitive_edges(self):
        self.db_manager.begin_transaction()
        print("Starting transitive reduction...")
        count_transitive_edges = 0

        nodes = self.db_manager.get_all_nodes()
        for node in tqdm(nodes, desc="Checking nodes"):
            start_time = time.time()
            edges = []
            neighbours = self.db_manager.get_node_neighbours(node['keyframe_id'])
            for neighbour in neighbours:
                edges.append({
                    'keyframe_id0': node['keyframe_id'],
                    'keyframe_id1': neighbour['keyframe_id'],
                    'length': self.get_edge_distance(node['keyframe_id'], neighbour['keyframe_id'])
                })

            edges.sort(key=lambda x: -x['length']) # longest edges first
            for edge in edges:
                if self.is_edge_transitive(edge):
                    self.db_manager.delete_edge(edge['keyframe_id0'], edge['keyframe_id1'])
                    count_transitive_edges += 1
            end_time = time.time()
            print(f"Node {node['keyframe_id']} took {end_time - start_time} seconds")
        self.db_manager.commit_transaction()
        print(f"Deleted {count_transitive_edges} transitive edges")

    
    def get_edge_distance(self, keyframe_id0: int, keyframe_id1: int) -> float: # distance between two nodes
        node0_info = self.db_manager.get_node_info(keyframe_id0)
        node1_info = self.db_manager.get_node_info(keyframe_id1)
        keyframe_id0, keyframe_id1 = sorted([int(keyframe_id0), int(keyframe_id1)])
        key = (keyframe_id0, keyframe_id1)
        if key in self.dp_cache:
            return self.dp_cache[key]
        distance = np.linalg.norm(np.array([node0_info['x_trans'], node0_info['y_trans'], node0_info['z_trans']]) - np.array([node1_info['x_trans'], node1_info['y_trans'], node1_info['z_trans']]))
        self.dp_cache[key] = distance
        return distance

   

    # This method will check if the same node can be reached within three jumps via another node, if so, return True. Runs a BFS to check if the same node can be reached within two jumps via another node.  
    def is_edge_transitive(self, edge: dict) -> bool:
        start_time = time.time()
        goal_id = edge['keyframe_id1']
        start_id = edge['keyframe_id0']
        queue = [(edge['keyframe_id0'], 0)]
        visited = set()
        while queue:
            current_node_id, depth = queue.pop(0)

            if current_node_id == goal_id:
                return True

            if depth > MAX_DEPTH or current_node_id in visited:
                continue

            visited.add(current_node_id)
            neighbours = self.db_manager.get_node_neighbours(current_node_id)
            for neighbour in neighbours:
                if neighbour['keyframe_id'] in visited:
                    continue
                if current_node_id == start_id and neighbour['keyframe_id'] == goal_id:
                    continue
                queue.append((neighbour['keyframe_id'], depth + 1))
        end_time = time.time()
        print(f"Edge {start_id} -> {goal_id} transitive check took {end_time - start_time} seconds")
        return False