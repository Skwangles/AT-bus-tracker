#!/usr/bin/env python3
"""
Database manager for GraphProcessor.

This module handles all database operations including creating working copies,
reading and writing data, and managing database connections.
"""

import sqlite3
import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import logging
from tqdm import tqdm

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Manages database operations for graph processing.
    
    This class handles creating working copies of databases, reading and writing
    data, and managing database connections safely.
    """
    
    def __init__(self, db_path: str):
        """
        Initialize the database manager.
        
        Args:
            db_path: Path to the SQLite database
        """
        self.db_path = Path(db_path)
        self.connection = None
        self.cursor = None
        
        # Ensure database exists
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {self.db_path}")
    
    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
    
    def connect(self):
        """Establish database connection."""
        try:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row  # Enable dict-like access
            self.cursor = self.connection.cursor()
            
            # Enable foreign keys
            self.cursor.execute("PRAGMA foreign_keys = ON")
            
            # Add custom functions
            self.connection.create_function("POWER", 2, lambda x, y: x ** y)
            self.connection.create_function("ABS", 1, abs)
            
            logger.debug(f"Connected to database: {self.db_path}")
            
        except sqlite3.Error as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def close(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            logger.debug("Database connection closed")
    
    def create_working_copy(self, suffix: str = "pruned_") -> str:
        """
        Create a new database file with the suffix added to the database name.
        If a working copy already exists, it will be deleted and recreated.
        
        Args:
            suffix: Suffix to add to the database filename (default: "pruned_")
            
        Returns:
            Path to the new database file
        """
        # Create new database path with suffix added to filename
        working_db_path = self.db_path.parent / f"{suffix}{self.db_path.name}"
        
        # Check if working copy already exists and delete it
        if working_db_path.exists():
            logger.info(f"Backing up existing working copy: {working_db_path}")
            working_db_path.rename(working_db_path.with_suffix(".old"))
        
        # Copy the database file
        shutil.copy2(self.db_path, working_db_path)
        logger.info(f"Created fresh working copy: {working_db_path}")
        
        return str(working_db_path)
    
 
    def execute_query(self, query: str, params: tuple = (), fetch_all: bool = True) -> List[Dict[str, Any]]:
        """
        Execute a query and return results.
        
        Args:
            query: SQL query to execute
            params: Query parameters
            fetch_all: Whether to fetch all results or just one
            
        Returns:
            List of dictionaries containing query results
        """
        if not self.cursor:
            raise RuntimeError("Database not connected - tried to execute query: " + query)
        
        try:
            self.cursor.execute(query, params)
            
            if fetch_all:
                results = self.cursor.fetchall()
                return [dict(row) for row in results]
            else:
                result = self.cursor.fetchone()
                return dict(result) if result else None
                
        except sqlite3.Error as e:
            logger.error(f"Query execution failed: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            raise
    
    def execute_write(self, query: str, params: tuple = ()) -> int:
        """
        Execute a write query and return number of affected rows.
        
        Args:
            query: SQL query to execute
            params: Query parameters
            
        Returns:
            Number of affected rows
        """
        if not self.cursor:
            raise RuntimeError("Database not connected - write query: " + query)
        
        try:
            self.cursor.execute(query, params)
            self.connection.commit()
            return self.cursor.rowcount
            
        except sqlite3.Error as e:
            logger.error(f"Write execution failed: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            self.connection.rollback()
            raise
    
    def begin_transaction(self):
        """Begin a database transaction."""
        if self.cursor:
            self.cursor.execute("BEGIN")
    
    def commit_transaction(self):
        """Commit the current transaction."""
        if self.connection:
            self.connection.commit()
    
    def rollback_transaction(self):
        """Rollback the current transaction."""
        if self.connection:
            self.connection.rollback()
    
    def get_all_nodes(self) -> List[Dict[str, Any]]:
        """Get all nodes in the database."""
        return self.execute_query("SELECT * FROM nodes")
    
    def get_node_count(self) -> int:
        """Get the total number of nodes in the database."""
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM nodes",
            fetch_all=False
        )
        return result['count'] if result else 0
    
    def get_edge_count(self) -> int:
        """Get the total number of edges in the database."""
        result = self.execute_query(
            "SELECT COUNT(*) as count FROM edges",
            fetch_all=False
        )
        return result['count'] if result else 0
    
    def get_node_info(self, keyframe_id: int) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific node.
        
        Args:
            keyframe_id: The keyframe ID to look up
            
        Returns:
            Dictionary containing node information or None if not found
        """
        return self.execute_query(
            """
            SELECT ts, pose, x_trans, y_trans, z_trans, zone
            FROM nodes 
            WHERE keyframe_id = ?
            """,
            (keyframe_id,),
            fetch_all=False
        )
    
    def get_node_neighbours(self, keyframe_id: int) -> List[Dict[str, Any]]:
        """
        Get all neighbours of a specific node.
        
        Args:
            keyframe_id: The keyframe ID to find neighbours for
            
        Returns:
            List of dictionaries containing neighbour information
        """
        return self.execute_query(
            """
            SELECT keyframe_id1 as keyframe_id, type, zone
            FROM edges 
            WHERE keyframe_id0 = ?

            UNION

            SELECT keyframe_id0 as keyframe_id, type, zone
            FROM edges e
            WHERE e.keyframe_id1 = ?
            """,
            (keyframe_id, keyframe_id,)
        )
    
    def delete_node(self, keyframe_id: int) -> int:
        """
        Delete a node and all its associated data.
        
        Args:
            keyframe_id: The keyframe ID to delete
            
        Returns:
            Number of affected rows
        """
        # Delete edges first (foreign key constraints will handle the rest)
        edge_deletions = self.execute_write(
            """
            DELETE FROM edges 
            WHERE keyframe_id0 = ? OR keyframe_id1 = ?
            """,
            (keyframe_id, keyframe_id)
        )
        
        # Delete the node
        node_deletions = self.execute_write(
            "DELETE FROM nodes WHERE keyframe_id = ?",
            (keyframe_id,)
        )
        
        return edge_deletions + node_deletions

    def delete_edge(self, keyframe_id0: int, keyframe_id1: int) -> int:
        """
        Delete an edge.
        
        Args:
            keyframe_id0: The keyframe ID of the first node
            keyframe_id1: The keyframe ID of the second node
        """
        return self.execute_write(
            "DELETE FROM edges WHERE (keyframe_id0 = ? AND keyframe_id1 = ?) OR (keyframe_id0 = ? AND keyframe_id1 = ?)",
            (keyframe_id0, keyframe_id1, keyframe_id1, keyframe_id0)
        )
    
    def update_node_position(self, keyframe_id: int, x_trans: float, y_trans: float, z_trans: float) -> int:
        """
        Update the position of a node.
        
        Args:
            keyframe_id: The keyframe ID to update
            x_trans: New X coordinate
            y_trans: New Y coordinate
            z_trans: New Z coordinate
            
        Returns:
            Number of affected rows
        """
        return self.execute_write(
            """
            UPDATE nodes 
            SET x_trans = ?, y_trans = ?, z_trans = ?
            WHERE keyframe_id = ?
            """,
            (x_trans, y_trans, z_trans, keyframe_id)
        )
    
    def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """
        Execute a query multiple times with different parameters.
        
        Args:
            query: SQL query to execute
            params_list: List of parameter tuples
            
        Returns:
            Number of affected rows
        """
        if not self.cursor:
            raise RuntimeError("Database not connected - tried to execute_many: " + query)
        
        try:
            self.cursor.executemany(query, params_list)
            self.connection.commit()
            return self.cursor.rowcount
            
        except sqlite3.Error as e:
            logger.error(f"Execute many failed: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Number of parameter sets: {len(params_list)}")
            self.connection.rollback()
            raise
    
    def flip_other_nodes_xy(self, scale_factor: float = 1.0) -> int:
        """
        Update all other_nodes to flip X and Y coordinates (negate them) while keeping Z unchanged.
        Transforms positions from (x, y, z) to (-x, -y, z).
        
        Returns:
            Number of other_nodes updated
        """
        try:
            # First, check if other_nodes table exists
            table_check = self.execute_query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='other_nodes'",
                fetch_all=False
            )
            
            if not table_check:
                logger.warning("other_nodes table does not exist in the database")
                return 0
            
            # Get all other_nodes with their current positions
            other_nodes = self.execute_query(
                """
                SELECT id, x_trans, y_trans, z_trans
                FROM other_nodes
                """
            )
            
            if not other_nodes:
                logger.info("No other_nodes found to update")
                return 0
            
            logger.info(f"Found {len(other_nodes)} other_nodes to update")
            
            # Update each other_node to (-x, -y, z)
            update_query = """
                UPDATE other_nodes
                SET x_trans = ?, y_trans = ?, z_trans = ?
                WHERE id = ?
            """
            
            params_list = [
                (-row['x_trans'] * scale_factor, -row['y_trans'] * scale_factor, row['z_trans'] * scale_factor, row['id'])
                for row in other_nodes
            ]
            
            # Use execute_many for efficiency (it handles transaction internally)
            affected_rows = self.execute_many(update_query, params_list)
            
            logger.info(f"Successfully updated {affected_rows} other_nodes to (-x, -y, z)")
            return affected_rows
                
        except sqlite3.Error as e:
            logger.error(f"Error in flip_other_nodes_xy: {e}")
            raise