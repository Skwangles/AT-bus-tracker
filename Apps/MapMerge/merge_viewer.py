#!/usr/bin/env python3
"""
Interactive Plotly/Dash-based map merging tool.

This module re-implements the original C++ merger from `merge.cpp`, adds a
viewer that lets users align two point clouds visually, and persists the chosen
transform back into an SQLite database.
"""
from __future__ import annotations

import argparse
import logging
import math
import shutil
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence, Tuple, Optional, Dict

import numpy as np
import json

try:
    import dash
    from dash import Dash, Input, Output, State, dcc, html
    from dash.exceptions import PreventUpdate
    import plotly.graph_objects as go
except ImportError:  # pragma: no cover - dash is optional for headless mode
    dash = None
    Dash = None
    Input = Output = State = dcc = html = None
    PreventUpdate = None
    go = None

LOGGER = logging.getLogger("map_merge")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

BLOB_LEN = 16 * 8  # 16 doubles encoded row-major
DEFAULT_LABEL_PREFIX = "$$"


@dataclass
class NodeInfo:
    """Lightweight representation of a labelled keyframe."""

    keyframe_id: int
    timestamp: float
    pose: np.ndarray
    translation: np.ndarray
    label: str


@dataclass
class TransformState:
    """User-controlled transform for the second point cloud."""

    tx: float = 0.0
    ty: float = 0.0
    tz: float = 0.0
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    scale: float = 1.0

    def as_matrix(self) -> np.ndarray:
        """Convert the stored Euler angles and translation into a 4x4 matrix."""
        rx = self._rotation_matrix(self.roll, axis="x")
        ry = self._rotation_matrix(self.pitch, axis="y")
        rz = self._rotation_matrix(self.yaw, axis="z")

        rotation = rz @ ry @ rx
        affine = np.eye(4, dtype=np.float64)
        affine[:3, :3] = rotation * self.scale
        affine[:3, 3] = np.array([self.tx, self.ty, self.tz], dtype=np.float64)
        return affine

    @staticmethod
    def _rotation_matrix(angle_deg: float, axis: str) -> np.ndarray:
        angle = math.radians(angle_deg)
        c = math.cos(angle)
        s = math.sin(angle)
        if axis == "x":
            return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=np.float64)
        if axis == "y":
            return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float64)
        if axis == "z":
            return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=np.float64)
        msg = f"Unknown axis '{axis}'"
        raise ValueError(msg)


def matrix_from_blob(blob: bytes) -> np.ndarray:
    """Deserialize a 4x4 row-major double matrix from SQLite."""
    if blob is None:
        raise ValueError("Pose blob is missing")
    if len(blob) != BLOB_LEN:
        raise ValueError(f"Expected {BLOB_LEN} bytes, received {len(blob)}")
    values = np.frombuffer(blob, dtype=np.float64, count=16)
    return values.reshape((4, 4))


def matrix_to_blob(matrix: np.ndarray) -> bytes:
    """Serialize a 4x4 row-major double matrix."""
    if matrix.shape != (4, 4):
        raise ValueError("Only 4x4 matrices can be serialised")
    return matrix.astype(np.float64).tobytes()


def transform_points(points: np.ndarray, transform: np.ndarray) -> np.ndarray:
    """Apply a homogeneous transformation to Nx3 points."""
    if not len(points):
        return points
    homog = np.concatenate([points, np.ones((points.shape[0], 1))], axis=1).T
    transformed = transform @ homog
    return transformed[:3, :].T


def euler_from_matrix(matrix: np.ndarray) -> Tuple[float, float, float]:
    """Extract roll, pitch, yaw (degrees) from a rotation matrix."""
    sy = math.sqrt(matrix[0, 0] ** 2 + matrix[1, 0] ** 2)
    singular = sy < 1e-6
    if not singular:
        roll = math.degrees(math.atan2(matrix[2, 1], matrix[2, 2]))
        pitch = math.degrees(math.atan2(-matrix[2, 0], sy))
        yaw = math.degrees(math.atan2(matrix[1, 0], matrix[0, 0]))
    else:
        roll = math.degrees(math.atan2(-matrix[1, 2], matrix[1, 1]))
        pitch = math.degrees(math.atan2(-matrix[2, 0], sy))
        yaw = 0.0
    return roll, pitch, yaw


class MapMerger:
    """Python port of the C++ MapMerger with optional viewer support."""

    def __init__(self, first_path: Path, second_path: Path):
        self.first_path = Path(first_path)
        self.second_path = Path(second_path)
        if not self.first_path.exists():
            msg = f"Cannot find first map file: {self.first_path}"
            raise FileNotFoundError(msg)
        if not self.second_path.exists():
            msg = f"Cannot find second map file: {self.second_path}"
            raise FileNotFoundError(msg)
        self.first_conn = sqlite3.connect(self.first_path)
        self.second_conn = sqlite3.connect(self.second_path)
        self.first_conn.row_factory = sqlite3.Row
        self.second_conn.row_factory = sqlite3.Row

    def close(self) -> None:
        self.first_conn.close()
        self.second_conn.close()

    # ------------------------------------------------------------------ #
    # Data extraction helpers
    # ------------------------------------------------------------------ #
    def extract_labeled_nodes(self, conn: sqlite3.Connection, prefix: str = DEFAULT_LABEL_PREFIX) -> List[NodeInfo]:
        query = """
            SELECT n.keyframe_id, n.ts, n.pose, n.x_trans, n.y_trans, n.z_trans, s.label
            FROM nodes n
            JOIN user_defined_labels s ON n.keyframe_id = s.keyframe_id
            WHERE s.label LIKE :prefix
        """
        cursor = conn.execute(query, {"prefix": f"{prefix}%"})
        nodes: List[NodeInfo] = []
        for row in cursor.fetchall():
            pose = matrix_from_blob(row["pose"])
            translation = np.array([row["x_trans"], row["y_trans"], row["z_trans"]], dtype=np.float64)
            nodes.append(
                NodeInfo(
                    keyframe_id=row["keyframe_id"],
                    timestamp=row["ts"],
                    pose=pose,
                    translation=translation,
                    label=row["label"],
                )
            )
        return nodes

    @staticmethod
    def find_matching_nodes(first_nodes: Sequence[NodeInfo], second_nodes: Sequence[NodeInfo]) -> List[Tuple[NodeInfo, NodeInfo]]:
        lookup: Dict[str, NodeInfo] = {node.label: node for node in second_nodes}
        pairs: List[Tuple[NodeInfo, NodeInfo]] = []
        for node in first_nodes:
            match = lookup.get(node.label)
            if match:
                pairs.append((node, match))
        return pairs

    @staticmethod
    def calculate_global_transform(matching_nodes: Sequence[Tuple[NodeInfo, NodeInfo]]) -> np.ndarray:
        if len(matching_nodes) < 2:
            raise ValueError("At least two matching nodes are required for alignment.")

        cloud1 = np.array([p[0].translation for p in matching_nodes]).T  # 3 x N
        cloud2 = np.array([p[1].translation for p in matching_nodes]).T

        centroid1 = np.mean(cloud1, axis=1, keepdims=True)
        centroid2 = np.mean(cloud2, axis=1, keepdims=True)

        centred1 = cloud1 - centroid1
        centred2 = cloud2 - centroid2

        covariance = np.zeros((2, 2))
        for idx in range(centred1.shape[1]):
            vec1 = np.array([centred1[0, idx], centred1[2, idx]])
            vec2 = np.array([centred2[0, idx], centred2[2, idx]])
            covariance += np.outer(vec1, vec2)

        u, _, vh = np.linalg.svd(covariance)
        rotation_2d = u @ vh
        if np.linalg.det(rotation_2d) < 0:
            rotation_2d[:, 1] *= -1

        rotation = np.eye(3)
        rotation[0, 0] = rotation_2d[0, 0]
        rotation[0, 2] = rotation_2d[0, 1]
        rotation[2, 0] = rotation_2d[1, 0]
        rotation[2, 2] = rotation_2d[1, 1]

        translation = (centroid1 - rotation @ centroid2).flatten()

        transform = np.eye(4)
        transform[:3, :3] = rotation
        transform[:3, 3] = translation
        return transform

    # ------------------------------------------------------------------ #
    # Utility queries
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_max_id(conn: sqlite3.Connection) -> int:
        row = conn.execute("SELECT MAX(keyframe_id) AS max_id FROM nodes").fetchone()
        return row["max_id"] if row and row["max_id"] is not None else -1

    @staticmethod
    def set_zones(conn: sqlite3.Connection, zone_name: str, only_nulls: bool) -> None:
        if not zone_name:
            LOGGER.info("No zone name supplied; skipping zone update.")
            return
        clause = "WHERE zone IS NULL" if only_nulls else ""
        for table in ("nodes", "edges", "node_locations", "user_defined_labels"):
            conn.execute(f"UPDATE {table} SET zone = ? {clause}", (zone_name,))
        conn.commit()

    @staticmethod
    def copy_edges(dst_conn: sqlite3.Connection, src_conn: sqlite3.Connection, offset: int) -> None:
        select_stmt = "SELECT keyframe_id0, keyframe_id1, type FROM edges"
        insert_stmt = "INSERT INTO edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, ?)"
        for row in src_conn.execute(select_stmt):
            dst_conn.execute(
                insert_stmt,
                (
                    row["keyframe_id0"] + offset,
                    row["keyframe_id1"] + offset,
                    row["type"],
                ),
            )

    @staticmethod
    def copy_node_locations(dst_conn: sqlite3.Connection, src_conn: sqlite3.Connection, offset: int) -> None:
        select_stmt = "SELECT keyframe_id, location FROM node_locations"
        insert_stmt = "INSERT INTO node_locations (keyframe_id, location) VALUES (?, ?)"
        for row in src_conn.execute(select_stmt):
            dst_conn.execute(insert_stmt, (row["keyframe_id"] + offset, row["location"]))

    @staticmethod
    def copy_user_defined_labels(dst_conn: sqlite3.Connection, src_conn: sqlite3.Connection, offset: int) -> None:
        other_nodes_select = """
            SELECT ref_id, label, description, type, x_trans, y_trans, z_trans
            FROM other_nodes
        """
        other_nodes_insert = """
            INSERT INTO other_nodes (ref_id, label, description, type, x_trans, y_trans, z_trans)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        for row in src_conn.execute(other_nodes_select):
            dst_conn.execute(
                other_nodes_insert,
                (
                    row["ref_id"] + offset,
                    row["label"],
                    row["description"],
                    row["type"],
                    row["x_trans"],
                    row["y_trans"],
                    row["z_trans"],
                ),
            )

        elevator_select = "SELECT shaft_id, id0, id1 FROM elevator_edges"
        elevator_insert = "INSERT INTO elevator_edges (shaft_id, id0, id1) VALUES (?, ?, ?)"
        for row in src_conn.execute(elevator_select):
            dst_conn.execute(elevator_insert, (row["shaft_id"], row["id0"], row["id1"]))

        labels_select = "SELECT keyframe_id, label FROM user_defined_labels"
        labels_insert = "INSERT INTO user_defined_labels (keyframe_id, label) VALUES (?, ?)"
        for row in src_conn.execute(labels_select):
            dst_conn.execute(labels_insert, (row["keyframe_id"] + offset, row["label"]))

    def create_loop_edges(self, conn: sqlite3.Connection, offset: int, pairs: Sequence[Tuple[NodeInfo, NodeInfo]]) -> None:
        insert_stmt = "INSERT INTO edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 2)"
        for left, right in pairs:
            id_a = left.keyframe_id
            id_b = right.keyframe_id + offset
            conn.execute(insert_stmt, (id_a, id_b))
            conn.execute(insert_stmt, (id_b, id_a))

    def copy_nodes(
        self,
        dst_conn: sqlite3.Connection,
        src_conn: sqlite3.Connection,
        offset: int,
        transform: np.ndarray,
    ) -> None:
        select_stmt = "SELECT ts, keyframe_id, pose, x_trans, y_trans, z_trans FROM nodes"
        insert_stmt = """
            INSERT INTO nodes (ts, keyframe_id, pose, x_trans, y_trans, z_trans)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        for row in src_conn.execute(select_stmt):
            pose_cw = matrix_from_blob(row["pose"])
            pose_wc = np.linalg.inv(pose_cw)
            transformed_pose = transform @ pose_wc
            pose_cw_out = np.linalg.inv(transformed_pose)

            translation = np.array([row["x_trans"], row["y_trans"], row["z_trans"], 1.0])
            transformed_translation = (transform @ translation)[:3]

            dst_conn.execute(
                insert_stmt,
                (
                    row["ts"],
                    row["keyframe_id"] + offset,
                    matrix_to_blob(pose_cw_out),
                    float(transformed_translation[0]),
                    float(transformed_translation[1]),
                    float(transformed_translation[2]),
                ),
            )

    def load_point_cloud(self, conn: sqlite3.Connection) -> np.ndarray:
        query = "SELECT x_trans, y_trans, z_trans FROM nodes"
        points = [tuple(row) for row in conn.execute(query)]
        if not points:
            return np.zeros((0, 3))
        return np.array(points, dtype=np.float64)

    def get_matching_pairs(self) -> List[Tuple[NodeInfo, NodeInfo]]:
        first_nodes = self.extract_labeled_nodes(self.first_conn)
        second_nodes = self.extract_labeled_nodes(self.second_conn)
        return self.find_matching_nodes(first_nodes, second_nodes)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def merge(
        self,
        out_path: Path,
        zone1: str,
        zone2: str,
        transform: Optional[np.ndarray],
        overwrite: bool,
    ) -> None:
        if out_path.exists() and not overwrite:
            msg = f"{out_path} exists. Pass --overwrite to replace it."
            raise FileExistsError(msg)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(self.first_path, out_path)
        out_conn = sqlite3.connect(out_path)
        out_conn.row_factory = sqlite3.Row

        try:
            self.set_zones(out_conn, zone1, only_nulls=False)
            pairs = self.get_matching_pairs()
            LOGGER.info("Found %s matching labelled nodes.", len(pairs))
            if transform is None:
                LOGGER.info("Calculating optimal transform using labelled nodes.")
                transform = self.calculate_global_transform(pairs)

            id_offset = self.get_max_id(out_conn) + 1
            if id_offset == 0:
                id_offset = 1
            LOGGER.info("Computed ID offset %s", id_offset)
            out_conn.execute("BEGIN")
            self.copy_nodes(out_conn, self.second_conn, id_offset, transform)
            self.copy_edges(out_conn, self.second_conn, id_offset)
            self.copy_node_locations(out_conn, self.second_conn, id_offset)
            self.copy_user_defined_labels(out_conn, self.second_conn, id_offset)
            self.create_loop_edges(out_conn, id_offset, pairs)
            out_conn.commit()
        except Exception:
            out_conn.rollback()
            raise
        else:
            self.set_zones(out_conn, zone2, only_nulls=True)
            LOGGER.info("Merge complete. Output: %s", out_path)
        finally:
            out_conn.close()


def build_figure(first_cloud: np.ndarray, second_cloud: np.ndarray) -> "go.Figure":
    fig = go.Figure()
    fig.add_trace(
        go.Scatter3d(
            x=first_cloud[:, 0],
            y=first_cloud[:, 1],
            z=first_cloud[:, 2],
            mode="markers",
            marker=dict(size=3, color="blue"),
            name="First map",
        )
    )
    fig.add_trace(
        go.Scatter3d(
            x=second_cloud[:, 0],
            y=second_cloud[:, 1],
            z=second_cloud[:, 2],
            mode="markers",
            marker=dict(size=3, color="red"),
            name="Second map",
        )
    )
    fig.update_layout(
        scene=dict(aspectmode="data"),
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(orientation="h"),
    )
    return fig


def start_viewer(merger: MapMerger, args: argparse.Namespace) -> None:
    if dash is None or Dash is None:
        raise RuntimeError("Dash and Plotly are required for viewer mode. Install dash[standard] and plotly.")

    first_cloud = merger.load_point_cloud(merger.first_conn)
    second_cloud = merger.load_point_cloud(merger.second_conn)
    if not len(first_cloud) or not len(second_cloud):
        raise RuntimeError("Both databases must contain nodes to render the viewer.")

    transform_state = TransformState()
    pairs = merger.get_matching_pairs()

    app: Dash = Dash(__name__)
    app.layout = html.Div(
        [
            html.H2("Sitexplorer Map Merge Viewer"),
            html.Div(
                [
                    html.Div(
                        [
                            html.Label("Translation (metres)"),
                            html.Div(
                                [
                                    dcc.Input(id="tx", type="number", value=0.0, step=0.1, placeholder="X"),
                                    dcc.Input(id="ty", type="number", value=0.0, step=0.1, placeholder="Y"),
                                    dcc.Input(id="tz", type="number", value=0.0, step=0.1, placeholder="Z"),
                                ],
                                className="translation-inputs",
                            ),
                            html.Label("Rotation (degrees)"),
                            html.Div(
                                [
                                    dcc.Input(id="roll", type="number", value=0.0, step=1.0, placeholder="Roll"),
                                    dcc.Input(id="pitch", type="number", value=0.0, step=1.0, placeholder="Pitch"),
                                    dcc.Input(id="yaw", type="number", value=0.0, step=1.0, placeholder="Yaw"),
                                ],
                                className="rotation-inputs",
                            ),
                            html.Label("Scale"),
                            dcc.Input(id="scale", type="number", value=1.0, step=0.01, min=0.01),
                            html.Div(
                                [
                                    html.Button("Auto Align (labels)", id="auto-align", n_clicks=0),
                                    html.Button("Write merged DB", id="write-db", n_clicks=0),
                                ],
                                className="action-buttons",
                            ),
                            html.Div(id="merge-status", className="status-message"),
                        ],
                        className="controls",
                    ),
                    dcc.Graph(id="cloud-viewer", figure=build_figure(first_cloud, second_cloud)),
                    html.Pre(id="transform-matrix", children=str(transform_state.as_matrix())),
                ]
            ),
            dcc.Store(id="matrix-store", data=transform_state.as_matrix().tolist()),
            dcc.Store(
                id="cloud-cache",
                data={"first": first_cloud.tolist(), "second": second_cloud.tolist()},
            ),
        ]
    )

    @app.callback(
        Output("matrix-store", "data"),
        Input("tx", "value"),
        Input("ty", "value"),
        Input("tz", "value"),
        Input("roll", "value"),
        Input("pitch", "value"),
        Input("yaw", "value"),
        Input("scale", "value"),
    )
    def update_matrix(tx, ty, tz, roll, pitch, yaw, scale):  # type: ignore[unused-ignore]
        state = TransformState(
            tx=float(tx or 0.0),
            ty=float(ty or 0.0),
            tz=float(tz or 0.0),
            roll=float(roll or 0.0),
            pitch=float(pitch or 0.0),
            yaw=float(yaw or 0.0),
            scale=float(scale or 1.0),
        )
        return state.as_matrix().tolist()

    @app.callback(
        Output("cloud-viewer", "figure"),
        Output("transform-matrix", "children"),
        Input("matrix-store", "data"),
        State("cloud-cache", "data"),
    )
    def refresh_graph(matrix_data, clouds):  # type: ignore[unused-ignore]
        matrix = np.array(matrix_data, dtype=np.float64)
        first = np.array(clouds["first"], dtype=np.float64)
        second = np.array(clouds["second"], dtype=np.float64)
        transformed_second = transform_points(second, matrix)
        figure = build_figure(first, transformed_second)
        return figure, np.array2string(matrix, precision=4)

    @app.callback(
        Output("tx", "value"),
        Output("ty", "value"),
        Output("tz", "value"),
        Output("roll", "value"),
        Output("pitch", "value"),
        Output("yaw", "value"),
        Output("scale", "value"),
        Input("auto-align", "n_clicks"),
        prevent_initial_call=True,
    )
    def auto_align(_):  # type: ignore[unused-ignore]
        if len(pairs) < 2:
            raise PreventUpdate  # type: ignore[misc]
        transform = merger.calculate_global_transform(pairs)
        roll, pitch, yaw = euler_from_matrix(transform[:3, :3])
        tx, ty, tz = transform[:3, 3]
        return tx, ty, tz, roll, pitch, yaw, 1.0

    @app.callback(
        Output("merge-status", "children"),
        Input("write-db", "n_clicks"),
        State("matrix-store", "data"),
        prevent_initial_call=True,
    )
    def write_db(_: int, matrix_data):  # type: ignore[unused-ignore]
        out_path = Path(args.out)
        try:
            merger.merge(
                out_path=out_path,
                zone1=args.zone1 or "",
                zone2=args.zone2,
                transform=np.array(matrix_data),
                overwrite=args.overwrite,
            )
            return f"Merged database written to {out_path}"
        except Exception as exc:  # pragma: no cover - user feedback
            LOGGER.exception("Failed to merge via viewer: %s", exc)
            return f"Merge failed: {exc}"

    app.run_server(debug=True, port=args.port)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sitexplorer Map Merge Python port with optional viewer.")
    parser.add_argument("first", help="First map to merge")
    parser.add_argument("second", help="Second map to merge")
    parser.add_argument("out", help="Output SQLite file")

    parser.add_argument("--zone1", default="", help="Optional zone name to assign to DB 1")
    parser.add_argument("--zone2", required=True, help="Zone name to set for DB 2 records without zones")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite the output database if it already exists")
    parser.add_argument(
        "--viewer",
        action="store_true",
        help="Launch Plotly/Dash viewer for manual alignment (alias for legacy --manual flag)",
    )
    parser.add_argument("--manual", action="store_true", help="Legacy alias for --viewer")
    parser.add_argument("--port", type=int, default=8050, help="Port for the Dash viewer")
    parser.add_argument("--transform-json", type=Path, help="Optional JSON file describing a transform matrix (4x4 list)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    merger = MapMerger(Path(args.first), Path(args.second))
    try:
        if args.viewer or args.manual:
            start_viewer(merger, args)
            return

        transform = None
        if args.transform_json:
            with args.transform_json.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            matrix_data = np.array(payload, dtype=np.float64)
            if matrix_data.shape != (4, 4):
                raise ValueError("Transform JSON must describe a 4x4 matrix.")
            transform = matrix_data

        merger.merge(
            out_path=Path(args.out),
            zone1=args.zone1 or "",
            zone2=args.zone2,
            transform=transform,
            overwrite=args.overwrite,
        )
    finally:
        merger.close()


if __name__ == "__main__":
    main()
