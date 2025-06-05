import sqlite3
import shutil
import sys
import argparse
import json

def parse_args():
    parser = argparse.ArgumentParser(description="Filter an SQLite3 database based on provided arguments")
    parser.add_argument('input_db', help="Path to the input SQLite3 database file")
    parser.add_argument('output_db', help="Path to the output SQLite3 database file")
    parser.add_argument('--del_non_prefix', help="Delete all tables that are non-prefixed e.g. nodes, node_locations, edges, etc. and keep refined_nodes, etc.", action='store_true')
    parser.add_argument('--prefix', help="Table prefix to add to tables")
    parser.add_argument('--remove_areas', type=str, help="List of locations to remove, e.g. '[\"floor1\", \"floor2\"]'")
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

def delete_filtered_nodes(prefix, db_cursor, remove_list, keep_id_list, keep_labels, del_non_prefix):
    """Delete nodes from refined_nodes based on provided filters."""
    remove_str = ', '.join(f"'{location}'" for location in remove_list)
    keep_id_str = ', '.join(map(str, keep_id_list))
    keep_label_str = ', '.join(f"'{label}'" for label in keep_labels)
    print("Deleteing with params: Prefix:", prefix, "Remove List:", remove_list, "Keep Id List:", keep_id_list, "Keep Labels:", keep_labels, "Del Non Prefix", del_non_prefix)

    # First, delete the nodes
    query = f"""
    DELETE FROM {prefix}nodes
    WHERE EXISTS (
        SELECT 1
        FROM {prefix}node_locations
        WHERE {prefix}nodes.keyframe_id = {prefix}node_locations.keyframe_id
          AND {prefix}node_locations.location IN ({remove_str})
    )
    AND {prefix}nodes.keyframe_id NOT IN ({keep_id_str})
    AND NOT EXISTS (
        SELECT 1
        FROM {prefix}user_defined_labels
        WHERE {prefix}nodes.keyframe_id = {prefix}user_defined_labels.keyframe_id
          AND {prefix}user_defined_labels.label IN ({keep_label_str})
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting nodes: ", db_cursor.rowcount)

    # Then, delete any orphaned labels (labels for nodes that no longer exist)
    query = f"""
    DELETE FROM {prefix}user_defined_labels
    WHERE NOT EXISTS (
        SELECT 1
        FROM {prefix}nodes
        WHERE {prefix}user_defined_labels.keyframe_id = {prefix}nodes.keyframe_id
    );
    """
    print("Running query:", query)
    db_cursor.execute(query)
    print("Deleting orphaned labels: ", db_cursor.rowcount)

    if del_non_prefix and prefix != "": 
        print("Deleting all tables not matching the table prefix")
        print("Removing tables: nodes, edges, node_locations, user_defined_labels, floorplan_points, floorplan_images")
        response = input("Are you sure? (Y/n):")
        while (response.lower() != '' and response.lower() != 'y' and response.lower() != 'n'):
            print("Invalid input, choose y or n")
            response = input("Are you sure? (Y/n):")
        if (response.lower() == 'y'):
            db_cursor.execute("DROP TABLE IF EXISTS nodes;")
            db_cursor.execute("DROP TABLE IF EXISTS edges;")
            db_cursor.execute("DROP TABLE IF EXISTS node_locations;")
            db_cursor.execute("DROP TABLE IF EXISTS user_defined_labels;")
            db_cursor.execute("DROP TABLE IF EXISTS floorplan_points;")
            db_cursor.execute("DROP TABLE IF EXISTS floorplan_images;")

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
    

    # Perform the deletion operation
    delete_filtered_nodes(prefix, cursor, remove_list, keep_id_list, keep_labels, del_non_prefix)

    # Commit changes and close the connection
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
