import sqlite3
import shutil
import argparse
import json

def parse_args():
    parser = argparse.ArgumentParser(description="Filter an SQLite3 database based on provided arguments")
    parser.add_argument('input_db', help="Path to the input SQLite3 database file")
    parser.add_argument('output_db', help="Path to the output SQLite3 database file")
    parser.add_argument('--del_non_prefix', help="Delete all tables that are non-prefixed e.g. nodes, node_locations, edges, etc. and keep prefixed tables, etc.", action='store_true')
    parser.add_argument('--prefix', default="", help="Table prefix to add to tables (optional)")
    parser.add_argument('--remove_areas', type=str, help="List of locations to remove, e.g. '[\"floor1\", \"floor2\"]'")
    parser.add_argument('--keep_id', type=str, help="List of IDs to keep, e.g. '[15, 16, 17]'")
    parser.add_argument('--keep_labels', type=str, help="List of labels to keep, e.g. '[\"reserved\"]'")
    parser.add_argument('--remove_duplicates', action='store_true', help="Remove duplicate other_nodes based on ref_id, label, and description")
    return parser.parse_args()

def copy_database(input_db, output_db):
    """Copy the input SQLite database to the output file."""
    shutil.copy(input_db, output_db)

def get_remove_list(remove_str):
    """Parse the 'remove' argument into a list."""
    if remove_str:
        return json.loads(remove_str)
    return []

def get_keep_id_list(keep_id_str):
    """Parse the 'keep_id' argument into a list."""
    if keep_id_str:
        return json.loads(keep_id_str)
    return []

def get_keep_labels(keep_labels_str):
    """Parse the 'keep_labels' argument into a list."""
    if keep_labels_str:
        return json.loads(keep_labels_str)
    return []

def remove_duplicate_other_nodes(prefix, db_cursor):
    """Remove duplicate other_nodes based on ref_id, label, and description."""
    print("Removing duplicate other_nodes...")
    
    # Find and delete duplicates, keeping the one with the lowest ID
    query = f"""
    DELETE FROM other_nodes
    WHERE id NOT IN (
        SELECT MIN(id)
        FROM other_nodes
        GROUP BY ref_id, label, description
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    deleted_count = db_cursor.rowcount
    print(f"Deleted {deleted_count} duplicate other_nodes")

def delete_filtered_nodes(prefix, db_cursor, remove_list, keep_id_list, keep_labels, del_non_prefix):
    """Delete nodes from nodes based on provided filters."""
    remove_str = ', '.join(f"'{location}'" for location in remove_list)
    keep_id_str = ', '.join(map(str, keep_id_list))
    keep_label_str = ', '.join(f"'{label}'" for label in keep_labels)
    print("Deleteing with params: Prefix:", prefix, "Remove List:", remove_list, "Keep Id List:", keep_id_list, "Keep Labels:", keep_labels, "Del Non Prefix", del_non_prefix)

    # First, delete the nodes
    query = f"""
    DELETE FROM nodes
    WHERE EXISTS (
        SELECT 1
        FROM node_locations
        WHERE nodes.keyframe_id = node_locations.keyframe_id
          AND node_locations.location IN ({remove_str})
    )
    AND nodes.keyframe_id NOT IN ({keep_id_str})
    AND NOT EXISTS (
        SELECT 1
        FROM other_nodes
        WHERE nodes.keyframe_id = other_nodes.ref_id
          AND other_nodes.label IN ({keep_label_str})
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting nodes: ", db_cursor.rowcount)

    # Delete orphaned other_nodes (nodes that no longer have a valid ref_id)
    query = f"""
    DELETE FROM other_nodes
    WHERE NOT EXISTS (
        SELECT 1
        FROM nodes
        WHERE other_nodes.ref_id = nodes.keyframe_id
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting orphaned other_nodes: ", db_cursor.rowcount)

    # Delete orphaned elevator_edges (edges that reference non-existent other_nodes)
    query = f"""
    DELETE FROM elevator_edges
    WHERE NOT EXISTS (
        SELECT 1
        FROM other_nodes
        WHERE elevator_edges.id0 = other_nodes.id
    )
    OR NOT EXISTS (
        SELECT 1
        FROM other_nodes
        WHERE elevator_edges.id1 = other_nodes.id
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting orphaned elevator_edges: ", db_cursor.rowcount)

    # Delete orphaned node_locations
    query = f"""
    DELETE FROM node_locations
    WHERE NOT EXISTS (
        SELECT 1
        FROM nodes
        WHERE node_locations.keyframe_id = nodes.keyframe_id
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting orphaned node_locations: ", db_cursor.rowcount)

    # Delete orphaned edges
    query = f"""
    DELETE FROM edges
    WHERE NOT EXISTS ( 
        SELECT 1
        FROM nodes
        WHERE edges.keyframe_id0 = nodes.keyframe_id
    ) OR NOT EXISTS (
        SELECT 1
        FROM nodes
        WHERE edges.keyframe_id1 = nodes.keyframe_id
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting orphaned edges: ", db_cursor.rowcount)


def main():
    args = parse_args()

    # Copy the database to the output location
    copy_database(args.input_db, args.output_db)
    
    # Connect to the copied database
    conn = sqlite3.connect(args.output_db)
    cursor = conn.cursor()

    # Parse arguments for filtering
    remove_list = get_remove_list(args.remove_areas)
    keep_id_list = get_keep_id_list(args.keep_id)
    keep_labels = get_keep_labels(args.keep_labels)
    del_non_prefix = args.del_non_prefix or False
    prefix = args.prefix or ""
    
    # Remove duplicates if requested
    if args.remove_duplicates:
        remove_duplicate_other_nodes(prefix, cursor)

    # Perform the deletion operation
    delete_filtered_nodes(prefix, cursor, remove_list, keep_id_list, keep_labels, del_non_prefix)

    # Commit changes and close the connection
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
