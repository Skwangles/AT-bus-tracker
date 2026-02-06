#!/bin/bash

function error_exit {
    echo "Error: $1"
    exit 1
}

# Exit on error
set -e

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}

echo "COPYING DATABASE AND FLOORPLANS"

# Check if the required inputs are provided as arguments or environment variables
if [[ -z "$SX_HOME_DIR" ]]; then
    error_exit "SX_HOME_DIR is not set"
fi

# Check if we have the necessary configuration variables
if [[ -z "$SX_DB_DIR" ]]; then
    error_exit "SX_DB_DIR is not set - please ensure configuration is loaded"
fi

if [[ -z "$SX_FLOORPLAN_DIR" ]]; then
    error_exit "SX_FLOORPLAN_DIR is not set - please ensure configuration is loaded"
fi

# Get destination directory from command line argument, config, or use default
DEST_DIR="${1:-${SX_EXPORT_DIR:-$SX_HOME_DIR/backup-env}}"

echo "Source database directory: $SX_DB_DIR"
echo "Source floorplan directory: $SX_FLOORPLAN_DIR"
echo "Destination directory: $DEST_DIR"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"
check_command "Creating destination directory"

# Copy database files
if [ -d "$SX_DB_DIR" ]; then
    echo "Copying database files from $SX_DB_DIR to $DEST_DIR"
    
    # Get the database name from configuration
    # Priority: server_db_name > authoring_db_name > export_db_name > default
    DB_NAME=""
    if [[ ! -z "$SX_SERVER_DB_NAME" ]]; then
        DB_NAME="$SX_SERVER_DB_NAME"
    elif [[ ! -z "$SX_AUTHORING_DB_NAME" ]]; then
        DB_NAME="$SX_AUTHORING_DB_NAME"
    elif [[ ! -z "$SX_EXPORT_DB_NAME" ]]; then
        DB_NAME="$SX_EXPORT_DB_NAME"
    else
        # Default to looking for .db files in the directory
        DB_FILES=$(find "$SX_DB_DIR" -maxdepth 1 -name "*.db" -type f | head -1)
        if [[ ! -z "$DB_FILES" ]]; then
            DB_NAME=$(basename "$DB_FILES")
        fi
    fi
    
    if [[ ! -z "$DB_NAME" ]]; then
        echo "Using database name: $DB_NAME"
        
        # Copy the main database file
        if [[ -f "$SX_DB_DIR/$DB_NAME" ]]; then
            cp "$SX_DB_DIR/$DB_NAME" "$DEST_DIR/"
            echo "Copied $DB_NAME"
        else
            echo "Warning: Database file $SX_DB_DIR/$DB_NAME not found"
        fi
        
        # Copy WAL file if it exists
        if [[ -f "$SX_DB_DIR/$DB_NAME-wal" ]]; then
            cp "$SX_DB_DIR/$DB_NAME-wal" "$DEST_DIR/"
            echo "Copied $DB_NAME-wal"
        fi
        
        # Copy SHM file if it exists
        if [[ -f "$SX_DB_DIR/$DB_NAME-shm" ]]; then
            cp "$SX_DB_DIR/$DB_NAME-shm" "$DEST_DIR/"
            echo "Copied $DB_NAME-shm"
        fi
        
        check_command "Copying database files"
    else
        echo "Warning: No database name found in configuration and no .db files in $SX_DB_DIR"
    fi
else
    echo "Warning: Database directory $SX_DB_DIR does not exist"
fi

# Copy floorplans directory
if [ -d "$SX_FLOORPLAN_DIR" ]; then
    echo "Copying floorplans from $SX_FLOORPLAN_DIR to $DEST_DIR"
    cp -r "$SX_FLOORPLAN_DIR" "$DEST_DIR/"
    check_command "Copying floorplans"
else
    echo "Warning: Floorplan directory $SX_FLOORPLAN_DIR does not exist"
fi

echo "Database and floorplans copied successfully to $DEST_DIR"
