import sqlite3
import numpy as np
import pyvista as pv
from tqdm import tqdm
import math

proximity = 1.5 / 10
SHOW_EDGES = True
EDGE_TYPE_EDGECONTRACTION = 3
EDGE_TYPE_COVISIBILITY = -1

db_path = ""

class Node:
    def __init__(self, keyframe_id, position, pose_cw: np.ndarray):
        self.keyframe_id = keyframe_id
        self.position = (float(position[0]), float(position[1]), float(position[2]),)
        self.pose = np.frombuffer(pose_cw, dtype=np.double).reshape(4, 4)
    
    def __str__(self):
        return f"Node {self.keyframe_id} at {self.position} with pose {self.pose}"
    
    def get_arrow(self):
        rot_mat = self.pose[:3, :3]
        yaw = np.arctan2(rot_mat[0, 0], rot_mat[0, 2])
        direction_vector = np.array([np.cos(yaw), 0, np.sin(yaw)])
        return pv.Cone(center=tuple(self.position), direction=direction_vector.tolist(), height=0.1, radius=0.1, resolution=50)

def load_nodes(db_path):
    """Load nodes from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    # Check if the prefixed table exists, otherwise use the regular table
    table_name = "nodes"
    
    sql_str = f"SELECT keyframe_id, x_trans, y_trans, z_trans, pose FROM nodes"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    nodes_data = cursor.fetchall()
    nodes = []
    for row in nodes_data:
        keyframe_id = int(row[0])  # Convert to integer
        node = Node(keyframe_id, [row[1], row[2], row[3]], row[4])
        nodes.append(node)
    connection.close()
    
    return nodes

def load_other_nodes(db_path):
    """Load other_nodes from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    # Check if other_nodes table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='other_nodes'")
    if not cursor.fetchone():
        print("other_nodes table not found, skipping...")
        connection.close()
        return []
    
    sql_str = "SELECT id, ref_id, label, description, info, image, type, x_trans, y_trans, z_trans FROM other_nodes"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    other_nodes_data = cursor.fetchall()
    connection.close()
    
    # Convert to Node objects for consistency
    other_nodes = []
    for row in other_nodes_data:
        node_id, ref_id, label, description, info, image, node_type, x_trans, y_trans, z_trans = row
        # Create a Node object with the other_node data
        # We'll use a special keyframe_id format to distinguish from regular nodes
        special_id = f"other_{node_id}"
        
        # Create a proper dummy pose matrix (4x4 identity matrix as bytes)
        dummy_pose = np.eye(4, dtype=np.double).tobytes()
        
        node = Node(special_id, [x_trans, y_trans, z_trans], dummy_pose)
        node.original_id = node_id
        node.ref_id = ref_id
        node.label = label
        node.description = description
        node.info = info or ""
        node.image = image or ""
        node.node_type = node_type
        other_nodes.append(node)
    
    return other_nodes

def load_edges(db_path, all=False):
    """Load edges from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    # Check if the prefixed table exists, otherwise use the regular table
    table_name = "edges"
    
            # Check if the table has the type and zone columns
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [column[1] for column in cursor.fetchall()]
    has_type_column = 'type' in columns
    has_zone_column = 'zone' in columns
        
    if has_type_column and has_zone_column:
            # Use the edges structure with type and zone
            if all:
                cursor.execute(f"SELECT keyframe_id0, keyframe_id1, type, zone FROM edges")
            else:
                cursor.execute(f"SELECT keyframe_id0, keyframe_id1, type, zone FROM edges WHERE type >= 0")
            print(f"Loading edges with type and zone from edges")
    else:
        # Fall back to basic structure
        if table_name == "edges":
            cursor.execute(f"SELECT keyframe_id0, keyframe_id1 FROM edges")  # Show all edges
            print(f"Loading all edges from edges (including covisibility edges)")
        else:
            cursor.execute(f"SELECT keyframe_id0, keyframe_id1 FROM edges WHERE " + ("type >= 0" if not all else " 1 = 1"))
    
    edges = cursor.fetchall()  # List of tuples
    connection.close()
    
    # Print some debugging information
    if edges:
        print(f"Loaded {len(edges)} edges")
        if len(edges[0]) >= 4:
            print(f"Edge structure includes type and zone columns")
            # Show some sample edges
            for i, edge in enumerate(edges[:5]):
                print(f"Sample edge {i}: {edge}")
        else:
            print(f"Edge structure is basic (keyframe_id0, keyframe_id1)")
    else:
        print("No edges found")
    
    return edges

def load_elevator_shafts(db_path):
    """Load elevator shafts from the SQLite database, grouped by shaft_id."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    # Check if elevator_shafts table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='elevator_shafts'")
    if not cursor.fetchone():
        print("elevator_shafts table not found, skipping...")
        connection.close()
        return {}
    
    sql_str = "SELECT other_node_id, shaft_id FROM elevator_shafts"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    rows = cursor.fetchall()
    
    # Group by shaft_id
    shafts = {}
    for other_node_id, shaft_id in rows:
        if shaft_id not in shafts:
            shafts[shaft_id] = []
        shafts[shaft_id].append(other_node_id)
    
    connection.close()
    
    return shafts

nodes = []
mapped = {}
idx_to_id = {}
pos_map = {}
picked_id = -1
second_id = -1
plotter = None

temp_viewed_mesh = []
edge_actors = []  # Store edge actors for toggling visibility

removeable_ids = []
addable_edges = []
removeable_edges = []

def export_changes():
    global db_path
    global removeable_edges
    global addable_edges
    global removeable_ids
    print("Query Prefix")
    try:
        print(db_path)
        connection = sqlite3.connect(db_path)
        cursor = connection.cursor()
        
        delete_edges = [(int(id), int(id),) for id in removeable_ids]
        delete_nodes = [(int(id),) for id in removeable_ids]
        
        print("Removing:", delete_nodes )
        cursor.executemany("DELETE FROM edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;", delete_edges)
        print("Wrote:", cursor.rowcount)
        cursor.executemany("DELETE FROM node_locations WHERE keyframe_id = ?;", delete_nodes)
        print("Wrote:", cursor.rowcount)
        
        # Delete from other_nodes table
        cursor.executemany("DELETE FROM other_nodes WHERE ref_id = ?;", delete_nodes)
        print("Wrote other_nodes:", cursor.rowcount)
        
        # Delete from elevator_shafts table (this will be handled by CASCADE, but we'll do it explicitly for safety)
        cursor.execute("DELETE FROM elevator_shafts WHERE other_node_id IN (SELECT id FROM other_nodes WHERE ref_id IN (" + ",".join("?" * len(delete_nodes)) + "));", delete_nodes)
        print("Wrote elevator_shafts:", cursor.rowcount)
        
        print("Wrote:", cursor.rowcount)
        cursor.executemany("DELETE FROM nodes WHERE keyframe_id = ?;", delete_nodes)
        print("Wrote:", cursor.rowcount)
        
        confirmed = input("Confirm removal (y/N):")
        if confirmed != 'y' and confirmed != 'Y':
            print("Aborting...")
            return
        
        connection.commit()
        cursor.close() 
        connection.close()

        print("Committed:", cursor.rowcount)
        
        addable_edges = []
        removeable_ids = []
        removeable_edges = []
    except sqlite3.Error as error:
        print("Failed to execute changes:", error)
    finally:
        if connection:
            connection.close()
            print("Connection closed")
        

def show_neighbours():
    global picked_id
    global temp_viewed_mesh
    
    if picked_id == -1 or picked_id == None:
        return
    
    print("Viewing neighbours for:", picked_id)
    
    for actor in temp_viewed_mesh:
        plotter.remove_actor(actor)
    
    try:
        connection = sqlite3.connect(db_path)
        cursor = connection.cursor()
        connection.create_function('sqrt', 1, math.sqrt)
        connection.create_function('pow', 2, math.pow)
        
        prox_neighbours = """WITH target_point AS(
                SELECT 
                x_trans,
                y_trans,
                z_trans
            FROM nodes
            WHERE keyframe_id = ?
            )

            SELECT
                rn.keyframe_id, rn.x_trans, rn.y_trans, rn.z_trans
                FROM nodes rn
            JOIN target_point ON(
                sqrt(pow(rn.x_trans - target_point.x_trans, 2) +
                    pow(rn.z_trans - target_point.z_trans, 2) +
                    pow(rn.y_trans - target_point.y_trans, 2))
                    <= ?
            )
            WHERE rn.keyframe_id != ?; """
        results = list(cursor.execute(prox_neighbours, (picked_id, proximity, picked_id)))
        
        
        
        ids = [result[0] for result in results]
        positions = [result[1:4] for result in results]
        print("IDs:", results)
        pnts = pv.PolyData(positions)
        
        actor = plotter.add_mesh(pnts, render_points_as_spheres=True, point_size=10.0, color='yellow')
        plotter.update()
        temp_viewed_mesh.append(actor)
            
    except sqlite3.Error as error:
        print("Failed to fetch:", error)
    finally:
        if connection:
            connection.close()


def connect_points():
    if second_id == -1 or second_id == None or picked_id == -1 or picked_id == None or picked_id == second_id:
        print("1 and 2 were equal, or one/both was unset (store the first point with '1') ")
        return
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    print("Connecting", picked_id, "to", second_id)

    find_zone_sql = "SELECT zone FROM nodes WHERE keyframe_id = ?"
    result = cursor.execute(find_zone_sql, (int(picked_id),))
    zone = result.fetchone()[0]
    print("Zone:", zone)

    # yes, this is vulnerable to SQL injection
    cursor.execute("INSERT INTO edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?", (picked_id, second_id, EDGE_TYPE_EDGECONTRACTION, zone, EDGE_TYPE_EDGECONTRACTION, EDGE_TYPE_COVISIBILITY,))
    cursor.execute("INSERT INTO edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?", (second_id, picked_id, EDGE_TYPE_EDGECONTRACTION, zone, EDGE_TYPE_EDGECONTRACTION, EDGE_TYPE_COVISIBILITY,))
    if (cursor.rowcount > 0):
        print("Edge created successfully. Restart to load...")
    connection.commit()
    cursor.close()
    connection.close()


def remove_point():
    global removeable_ids
    global picked_id
    
    if picked_id == -1: 
        return
    print("Marked", picked_id, "for removal")
    removeable_ids.append(picked_id)
    
def store_point():
    global picked_id
    global second_id
    if picked_id == -1 or picked_id == None:
        return
    second_id = picked_id
    print("Stored:", second_id)

def toggle_edges():
    global edge_actors
    global plotter
    
    if not edge_actors:
        print("No edges to toggle")
        return
    
    # Toggle visibility of all edge actors
    for actor in edge_actors:
        if actor.GetVisibility():
            actor.SetVisibility(False)
        else:
            actor.SetVisibility(True)
    
    plotter.render()
    print("Toggled edge visibility")
    
def picked_point(picked):
    global picked_id
    pos = str(f"[{picked[0]:.3f}, {picked[1]:.3f}, {picked[2]:.3f}]")
    if pos not in pos_map:
        print("pos not in pos_map", pos)
        return
    pos_pos = pos_map[pos]
    id = idx_to_id[pos_map[pos_pos]]
    if id != None and id != -1:
        picked_id = id

def get_lines_from_ids(edge1, edge2, nodes_list):
    # Check if both nodes exist in our mapping
    if edge1 not in mapped or edge2 not in mapped:
        print(f"Warning: Edge references non-existent nodes: {edge1} -> {edge2}")
        print(f"Available node IDs: {list(mapped.keys())[:20]}...")
        return None
    
    # Check if the mapped indices are valid
    if mapped[edge1] >= len(nodes_list) or mapped[edge2] >= len(nodes_list):
        print(f"Warning: Edge references invalid node indices: {edge1} -> {edge2}")
        return None
    
    p0, p1 = nodes_list[mapped[edge1]], nodes_list[mapped[edge2]]
    return [p0, p1]

def render(nodes_list, other_nodes_list=None, edges=None, elevator_shafts=None):
    """Render nodes and edges in 3D using PyVista."""
    global pos_map
    global idx_to_id
    global mapped
    global plotter
    global nodes
    global second_id
    
    plotter = pv.Plotter()
    
    print("Creating a lookup for the keyframe id")
    print(f"Number of nodes in nodes_list: {len(nodes_list)}")
    for i, node in tqdm(enumerate(nodes_list)):
        mapped[node.keyframe_id] = i
        idx_to_id[i] = node.keyframe_id
    
    print(f"Created mapping for {len(mapped)} nodes")
    print(f"Sample mappings: {list(mapped.items())[:10]}")
    
    for i, node in tqdm(enumerate(nodes_list)):
        pos = f"[{node.position[0]:.4f}, {node.position[1]:.4f}, {node.position[2]:.4f}]"
        pos_map[pos] = i
    print("pos map", pos_map.keys())
        
    # Add other_nodes to the lookup as well
    if other_nodes_list:
        start_idx = len(nodes_list)
        for i, node in tqdm(enumerate(other_nodes_list)):
            mapped[node.keyframe_id] = start_idx + i
            idx_to_id[start_idx + i] = node.keyframe_id
    
    # Add nodes to the plot
    print("Adding nodes to the plot...")
    # Create a PolyData object with the points rendered as arrows
    
    points = pv.PolyData(list(map(lambda x: x.position, nodes)))
    for node in tqdm(nodes_list):
        plotter.add_mesh(node.get_arrow(), color="green", pickable=True)
        # plotter.add_point_labels(node.position, [str(node.keyframe_id)], font_size=10, point_size=10, color="black")
    
    # Add other_nodes to the plot in a different color
    if other_nodes_list:
        print("Adding other_nodes to the plot...")
        for node in tqdm(other_nodes_list):
            # Create a sphere instead of arrow for other_nodes
            # Color based on node type
            type_colors = {
                0: "gray",      # Normal
                1: "red",       # Elevator
                2: "orange",    # Toilet
                3: "purple"     # Info
            }
            node_color = type_colors.get(node.node_type, "blue")
            sphere = pv.Sphere(center=node.position, radius=0.05)
            plotter.add_mesh(sphere, color=node_color, pickable=True)
            # Add a small label showing the node type
            type_names = {0: "N", 1: "E", 2: "I", 3: "R"}  # Normal, Elevator, Info, Room
            if node.node_type != 0:
                type_label = type_names.get(node.node_type, "?")
                plotter.add_point_labels(node.position, [type_label], font_size=8, point_size=8)
        
    # Add legend
    legend_entries = [
        ("N", "Normal node"),
        ("E", "Elevator node"),
        ("I", "Info/Toilet node"),
        ("R", "Room node")
    ]
    
    # Create a simple text legend
    legend_text = "\n".join([f"{symbol}: {description}" for symbol, description in legend_entries])
    plotter.add_text(legend_text, position='upper_left', font_size=12, color='black')
        
    # print("Points:", points)
    plotter.add_mesh(points, color="blue", point_size=5.0, render_points_as_spheres=True, pickable=True)
    plotter.add_axes(interactive=True)
    plotter.add_axes_at_origin(labels_off=True)

    # Add edges to the plot (optional)
    if SHOW_EDGES and edges:
        print("Adding edges...")
        lines = []
        valid_edges = 0
        invalid_edges = 0
        
        # Define edge type colours
        edge_type_colors = {
            0: "blue",      # Default/unknown type
            1: "green",     # Type 1
            2: "orange",    # Type 2 (default)
            3: "red",       # Type 3 (edge contraction)
            -1: "purple"    # Covisibility edges
        }
        
        for edge in tqdm(edges):
            # Handle different edge data structures
            if len(edge) >= 4:
                # Enhanced structure with type and zone
                edge_id0, edge_id1, edge_type, zone = edge[0], edge[1], edge[2], edge[3]
                edge_color = edge_type_colors.get(edge_type, "gray")
                line_width = 2.0 if edge_type == 3 else 1.0  # Thicker lines for edge contraction
            else:
                # Basic structure
                edge_id0, edge_id1 = edge[0], edge[1]
                edge_color = "red"
                line_width = 1.0
            
            line_points = get_lines_from_ids(edge_id0, edge_id1, nodes_list)
            if line_points is not None:
                [p0, p1] = line_points
                line = pv.Line(p0.position, p1.position)
                actor = plotter.add_mesh(line, color=edge_color, line_width=line_width, pickable=False)
                edge_actors.append(actor)
                valid_edges += 1
            else:
                invalid_edges += 1
        
        print(f"Rendered {valid_edges} valid edges, skipped {invalid_edges} invalid edges")
    
    # Add elevator shafts if available (create edges between all nodes in the same shaft)
    if elevator_shafts:
        print("Adding elevator shafts...")
        elevator_valid = 0
        elevator_invalid = 0
        for shaft_id, node_ids in tqdm(elevator_shafts.items()):
            # Create edges between all pairs of nodes in the same shaft
            for i in range(len(node_ids)):
                for j in range(i + 1, len(node_ids)):
                    node_id0, node_id1 = node_ids[i], node_ids[j]
                    # Use special ID format for other nodes (matching load_other_nodes format)
                    special_id0 = f"other_{node_id0}"
                    special_id1 = f"other_{node_id1}"
                    line_points = get_lines_from_ids(special_id0, special_id1, nodes_list)
                    if line_points is not None:
                        [p0, p1] = line_points
                        line = pv.Line(p0.position, p1.position)
                        actor = plotter.add_mesh(line, color="cyan", line_width=3.0, pickable=False)
                        edge_actors.append(actor)
                        elevator_valid += 1
                    else:
                        elevator_invalid += 1
        
        print(f"Rendered {elevator_valid} valid elevator edges, skipped {elevator_invalid} invalid elevator edges")

    # Show the 3D scene
    print("Showing...")
    plotter.enable_point_picking(callback=picked_point)
    plotter.add_key_event('d', callback=remove_point)
    plotter.add_key_event('e', callback=export_changes)
    plotter.add_key_event('n', callback=show_neighbours)
    plotter.add_key_event('1', callback=store_point)
    plotter.add_key_event('2', callback=connect_points)
    plotter.add_key_event('t', callback=toggle_edges)
    plotter.show()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python render.py <database file>")
        sys.exit(1)

    db_path = sys.argv[1]
        
    nodes = load_nodes(db_path)
    other_nodes = load_other_nodes(db_path)
    edges = load_edges(db_path, False)
    elevator_shafts = load_elevator_shafts(db_path)

    print(f"Loaded {len(nodes)} nodes.")
    print(f"Loaded {len(other_nodes)} other_nodes.")
    print(f"Loaded {len(edges)} edges.")
    total_shaft_nodes = sum(len(nodes) for nodes in elevator_shafts.values())
    print(f"Loaded {len(elevator_shafts)} elevator shafts ({total_shaft_nodes} nodes).")
    
    print(""" Controls 
          p - select point
          d - add selected point to 'remove' list
          1 - store the selected point as the 1st of 2 points
          2 - connect the current selected point to the point stored in 1
          e - execute the actions - e.g. remove IDs from the remove list
          n - show neighbours of selected point
          t - toggle edge visibility
          """)

    render(nodes, other_nodes, edges, elevator_shafts)
