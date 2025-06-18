import sqlite3
import numpy as np
import pyvista as pv
from tqdm import tqdm
import math

proximity = 1.5 / 10
SHOW_EDGES = False
EDGE_TYPE_EDGECONTRACTION = 3
EDGE_TYPE_COVISIBILITY = -1

table_name_prefix = "refined_"
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
    sql_str = "SELECT keyframe_id, x_trans, y_trans, z_trans, pose FROM "+ table_name_prefix+"nodes"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    nodes = list(map(lambda x: Node(x[0], [x[1], x[2], x[3]], x[4]), np.array(cursor.fetchall())))
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
    
    sql_str = "SELECT id, ref_id, label, description, type, x_trans, y_trans, z_trans FROM other_nodes"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    other_nodes_data = cursor.fetchall()
    connection.close()
    
    # Convert to Node objects for consistency
    other_nodes = []
    for row in other_nodes_data:
        node_id, ref_id, label, description, node_type, x_trans, y_trans, z_trans = row
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
        node.node_type = node_type
        other_nodes.append(node)
    
    return other_nodes

def load_edges(db_path, all=False):
    """Load edges from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("SELECT keyframe_id0, keyframe_id1 FROM "+ table_name_prefix+"edges WHERE " + ("type >= 0" if not all else " 1 = 1")) # 'Covisibility edges' are type = -1
    edges = cursor.fetchall()  # List of tuples
    connection.close()
    return edges

def load_elevator_edges(db_path):
    """Load elevator edges from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    
    # Check if elevator_edges table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='elevator_edges'")
    if not cursor.fetchone():
        print("elevator_edges table not found, skipping...")
        connection.close()
        return []
    
    sql_str = "SELECT id, shaft_id, id0, id1 FROM elevator_edges"
    print("Executing:", sql_str)
    cursor.execute(sql_str)
    elevator_edges_data = cursor.fetchall()
    connection.close()
    
    return elevator_edges_data

nodes = []
mapped = {}
idx_to_id = {}
pos_map = {}
picked_id = -1
second_id = -1
plotter = None

temp_viewed_mesh = []

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
        cursor.executemany("DELETE FROM " + table_name_prefix + "edges WHERE keyframe_id0 = ? OR keyframe_id1 = ?;", delete_edges)
        print("Wrote:", cursor.rowcount)
        cursor.executemany("DELETE FROM " + table_name_prefix + "node_locations WHERE keyframe_id = ?;", delete_nodes)
        print("Wrote:", cursor.rowcount)
        cursor.executemany("DELETE FROM " + table_name_prefix + "user_defined_labels WHERE keyframe_id = ?;", delete_nodes)
        print("Wrote:", cursor.rowcount)
        cursor.executemany("DELETE FROM " + table_name_prefix+ "nodes WHERE keyframe_id = ?;", delete_nodes)
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
            FROM """ + table_name_prefix + """nodes
            WHERE keyframe_id = ?
            )

            SELECT
                rn.keyframe_id, rn.x_trans, rn.y_trans, rn.z_trans
                FROM """+ table_name_prefix + """nodes rn
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

    find_zone_sql = "SELECT zone FROM " + table_name_prefix + "nodes WHERE keyframe_id = ?"
    result = cursor.execute(find_zone_sql, (int(picked_id),))
    zone = result.fetchone()[0]
    print("Zone:", zone)

    cursor.execute("INSERT INTO " + table_name_prefix + "edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?", (picked_id, second_id, EDGE_TYPE_EDGECONTRACTION, zone, EDGE_TYPE_EDGECONTRACTION, EDGE_TYPE_COVISIBILITY,))
    cursor.execute("INSERT INTO " + table_name_prefix + "edges (keyframe_id0, keyframe_id1, type, zone) VALUES (?, ?, ?, ?) ON CONFLICT (keyframe_id0, keyframe_id1) DO UPDATE SET type=? WHERE type = ?", (second_id, picked_id, EDGE_TYPE_EDGECONTRACTION, zone, EDGE_TYPE_EDGECONTRACTION, EDGE_TYPE_COVISIBILITY,))
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
    
def picked_point(picked):
    global picked_id
    id = idx_to_id[pos_map[str(picked)]]
    print("Picked", picked, "Keyframe_id:", id)
    if id != None and id != -1:
        picked_id = id

def get_lines_from_ids(edge1, edge2):
    p0, p1 = nodes[mapped[edge1]], nodes[mapped[edge2]]
    return [p0, p1]

def render(nodes_list, other_nodes_list=None, edges=None):
    """Render nodes and edges in 3D using PyVista."""
    global pos_map
    global idx_to_id
    global mapped
    global plotter
    global nodes
    global second_id
    
    plotter = pv.Plotter()
    
    print("Creating a lookup for the keyframe id")
    for i, node in tqdm(enumerate(nodes_list)):
        mapped[node.keyframe_id] = i
        idx_to_id[i] = node.keyframe_id
    
    for i, node in tqdm(enumerate(nodes)):
        pos_map[str(node.position)] = i
        
    # Add other_nodes to the lookup as well
    if other_nodes_list:
        start_idx = len(nodes_list)
        for i, node in tqdm(enumerate(other_nodes_list)):
            mapped[node.keyframe_id] = start_idx + i
            idx_to_id[start_idx + i] = node.keyframe_id
    
    # Add nodes to the plot
    print("Adding nodes to the plot...")
    # Create a PolyData object with the points rendered as arrows
    
    # points = pv.PolyData(list(map(lambda x: x.position, nodes.position)))
    for node in tqdm(nodes):
        plotter.add_mesh(node.get_arrow(), color="green", pickable=True)
        # plotter.add_point_labels(node.position, [str(node.keyframe_id)], font_size=10, point_size=10, color="black")
    
    # Add other_nodes to the plot in a different color
    if other_nodes_list:
        print("Adding other_nodes to the plot...")
        for node in tqdm(other_nodes_list):
            # Create a sphere instead of arrow for other_nodes
            sphere = pv.Sphere(center=node.position, radius=0.05)
            plotter.add_mesh(sphere, color="blue", pickable=True)
            # Add a small label showing the node type
            type_names = {0: "N", 1: "E", 2: "I", 3: "R"}  # Normal, Elevator, Info, Room
            type_label = type_names.get(node.node_type, "?")
            plotter.add_point_labels(node.position, [type_label], font_size=8, point_size=8, color="white")
        
    # Add legend
    legend_entries = [
        ("Green Arrows", "Regular SLAM nodes"),
        ("Blue Spheres", "Other nodes (elevators, info, etc.)"),
        ("N", "Normal node"),
        ("E", "Elevator node"),
        ("I", "Info/Toilet node"),
        ("R", "Room node")
    ]
    
    # Create a simple text legend
    legend_text = "\n".join([f"{symbol}: {description}" for symbol, description in legend_entries])
    plotter.add_text(legend_text, position='upper_left', font_size=12, color='black')
        
    # print("Points:", points)
    # plotter.add_mesh(points, color="blue", point_size=5.0, render_points_as_spheres=True, pickable=True)
    plotter.add_axes(True)
    plotter.add_axes_at_origin(labels_off=True)

    # Add edges to the plot (optional)
    if SHOW_EDGES and edges:
        print("Adding edges...")
        lines = []
        for edge in tqdm(edges):
            [p0, p1] = get_lines_from_ids(edge[0], edge[1])
            line = pv.Line(p0, p1)
            plotter.add_mesh(line, color="red", line_width=1.0, pickable=False)

    # Show the 3D scene
    print("Showing...")
    plotter.enable_point_picking(callback=picked_point)
    plotter.add_key_event('d', callback=remove_point)
    plotter.add_key_event('e', callback=export_changes)
    plotter.add_key_event('n', callback=show_neighbours)
    plotter.add_key_event('1', callback=store_point)
    plotter.add_key_event('2', callback=connect_points)
    plotter.show()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python render.py <database file> <optional - table_name_prefix e.g. 'refined_'>")
        sys.exit(1)

    db_path = sys.argv[1]
    
    if len(sys.argv) == 3:
        if (sys.argv[2].lower() != "None".lower() and sys.argv[2] != ""):
            table_name_prefix = sys.argv[2]
        else: 
            table_name_prefix = ""
        
    nodes = load_nodes(db_path)
    other_nodes = load_other_nodes(db_path)
    edges = load_edges(db_path, False)
    elevator_edges = load_elevator_edges(db_path)

    print(f"Loaded {len(nodes)} nodes.")
    print(f"Loaded {len(other_nodes)} other_nodes.")
    print(f"Loaded {len(edges)} edges.")
    print(f"Loaded {len(elevator_edges)} elevator edges.")
    
    print(""" Controls 
          p - select point
          d - add selected point to 'remove' list
          1 - store the selected point as the 1st of 2 points
          2 - connect the current selected point to the point stored in 1
          e - execute the actions - e.g. remove IDs from the remove list
          """)

    render(nodes, other_nodes, edges)
