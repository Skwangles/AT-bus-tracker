import sqlite3
import shutil
import sys
import argparse
import json

def parse_args():
    parser = argparse.ArgumentParser(description="Filter an SQLite3 database based on provided arguments")
    parser.add_argument('input_db', help="Path to the input SQLite3 database file")
    parser.add_argument('output_db', help="Path to the output SQLite3 database file")
    parser.add_argument('--remove', type=str, help="List of locations to remove, e.g. '[\"floor1\", \"floor2\"]'")
    parser.add_argument('--keep_id', type=str, help="List of IDs to keep, e.g. '[15, 16, 17]'")
    parser.add_argument('--keep_labels', type=str, help="List of labels to keep, e.g. '[\"reserved\"]'")
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

def delete_filtered_nodes(db_cursor, remove_list, keep_id_list, keep_labels):
    """Delete nodes from refined_nodes based on provided filters."""
    remove_str = ', '.join(f"'{location}'" for location in remove_list)
    keep_id_str = ', '.join(map(str, keep_id_list))
    keep_label_str = ', '.join(f"'{label}'" for label in keep_labels)

    query = f"""
    DELETE FROM refined_nodes
    WHERE EXISTS (
        SELECT 1
        FROM refined_node_locations
        WHERE refined_nodes.keyframe_id = refined_node_locations.keyframe_id
          AND refined_node_locations.location IN ({remove_str})
    )
    AND refined_nodes.keyframe_id NOT IN ({keep_id_str})
    AND EXISTS (
        SELECT 1
        FROM refined_special_labels
        WHERE refined_nodes.keyframe_id = refined_special_labels.keyframe_id
          AND refined_special_labels.label IN ({keep_label_str})
    );
    """
    db_cursor.execute(query)

def main():
    args = parse_args()

    # Copy the database to the output location
    copy_database(args.input_db, args.output_db)
    
    # Connect to the copied database
    conn = sqlite3.connect(args.output_db)
    cursor = conn.cursor()

    # Parse arguments for filtering
    remove_list = get_remove_list(args.remove)
    keep_id_list = get_keep_id_list(args.keep_id)
    keep_labels = get_keep_labels(args.keep_labels)

    # Perform the deletion operation
    delete_filtered_nodes(cursor, remove_list, keep_id_list, keep_labels)

    # Commit changes and close the connection
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
