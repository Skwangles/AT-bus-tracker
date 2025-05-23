#!/bin/bash
echo "RUNNING STRIP RESTRICTED NODES SCRIPT - Args: <INPUT_DB_PATH> <OUTPUT_DB_PATH> <REMOVE_LIST> <KEEP_ID_LIST> <KEEP_LABELS>"

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

ORIGINAL_DIR=$(pwd)

# Check if CV_HOME_DIR is set
[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR environment variable is not set"

# Check if the required inputs are empty
[[ -z "$1" && (-z "$CV_STRIP_INPUT_DB" || -z "$CV_DB_DIR") ]] && error_exit "Input SQLite3 database is not provided as an argument or environment variable"
[[ -z "$2" && (-z "$CV_STRIP_OUTPUT_DB" || -z "$CV_DB_DIR") ]] && error_exit "Output SQLite3 database is not provided as an argument or environment variable"
[[ -z "$3" && -z "$CV_STRIP_REMOVE" ]] && error_exit "Remove list (locations) is not provided as an argument or environment variable"

# Assign arguments or environment variables
INPUT_DB=${1:-$CV_DB_DIR/$CV_STRIP_INPUT_DB}
OUTPUT_DB=${2:-$CV_DB_DIR/$CV_STRIP_OUTPUT_DB}
REMOVE_LIST=${3:-$CV_STRIP_REMOVE}
KEEP_ID_LIST=${4:-$CV_STRIP_KEEP_ID}
KEEP_LABELS=${5:-$CV_STRIP_KEEP_LABELS}
TABLE_PREFIX=${6:-$CV_STRIP_TABLE_PREFIX}

echo "Arg 1 - Input DB: $INPUT_DB"
echo "Arg 2 - Output DB: $OUTPUT_DB"
echo "Arg 3 - Remove list (locations): $REMOVE_LIST"
echo "Arg 4 - Keep ID list: $KEEP_ID_LIST"
echo "Arg 5 - Keep labels list: $KEEP_LABELS"
echo "Arg 6 - Table Prefix: $TABLE_PREFIX"

# Check if the input database exists
[[ ! -f "$INPUT_DB" ]] && error_exit "Input database $INPUT_DB does not exist"

# Check if the output directory exists, create it if it doesn't
OUTPUT_DIR=$(dirname "$OUTPUT_DB")
if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Output directory $OUTPUT_DIR does not exist, creating it"
    mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory $OUTPUT_DIR"
fi

# Run the Python script
cd "$CV_HOME_DIR/Apps/strip_restricted" || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/strip_restricted"
python3 strip_restricted_nodes.py "$INPUT_DB" "$OUTPUT_DB" --prefix="$TABLE_PREFIX" --remove_areas="$REMOVE_LIST" --keep_id="$KEEP_ID_LIST" --keep_labels="$KEEP_LABELS" --del_non_prefix || error_exit "Python script failed"
cd "$ORIGINAL_DIR" || error_exit "Failed to change back to the original directory"
