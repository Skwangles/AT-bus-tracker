import sqlite3
import numpy as np
import pyvista as pv

query_prefix = "refined_"

def load_nodes(db_path):
    """Load nodes from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("SELECT keyframe_id, x_trans, y_trans, z_trans FROM "+ query_prefix+"nodes")
    nodes = np.array(cursor.fetchall())
    connection.close()
    return nodes

def load_edges(db_path):
    """Load edges from the SQLite database."""
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("SELECT keyframe_id0, keyframe_id1 FROM "+ query_prefix+"edges WHERE type >= 0") # 'Covisibility edges' are type = -1
    edges = cursor.fetchall()  # List of tuples
    connection.close()
    return edges

def render(nodes, edges=None):
    """Render nodes and edges in 3D using PyVista."""
    plotter = pv.Plotter()

    mapped = {}
    for i, node in enumerate(nodes):
        mapped[node[0]] = i
    
    nodes = list(map(lambda node: node[1:], nodes))
    
    # Add nodes to the plot
    points = pv.PolyData(nodes)
    plotter.add_mesh(points, color="blue", point_size=5.0, render_points_as_spheres=True)
    plotter.add_axes(True)
    plotter.add_axes_at_origin(labels_off=True)

    # Add edges to the plot (optional)
    if edges:
        for edge in edges:
            p0, p1 = nodes[mapped[edge[0]]], nodes[mapped[edge[1]]]
            line = pv.Line(p0, p1)
            plotter.add_mesh(line, color="red", line_width=1.0)

    # Show the 3D scene
    plotter.show()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python render.py <database file>")
        sys.exit(1)

    db_path = sys.argv[1]
    nodes = load_nodes(db_path)
    edges = load_edges(db_path)

    print(f"Loaded {len(nodes)} nodes.")
    print(f"Loaded {len(edges)} edges.")

    render(nodes, edges)
