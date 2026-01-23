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

# Check if SX_HOME_DIR is set
[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR environment variable is not set"

# Check if the required inputs are empty
[[ -z "$1" && (-z "$SX_STRIP_INPUT_DB" || -z "$SX_DB_DIR") ]] && error_exit "Input SQLite3 database is not provided as an argument or environment variable"
[[ -z "$2" && (-z "$SX_STRIP_OUTPUT_DB" || -z "$SX_DB_DIR") ]] && error_exit "Output SQLite3 database is not provided as an argument or environment variable"
[[ -z "$3" && -z "$SX_STRIP_REMOVE" ]] && error_exit "Remove list (locations) is not provided as an argument or environment variable"

# Assign arguments or environment variables
INPUT_DB=${1:-$SX_DB_DIR/$SX_STRIP_INPUT_DB}
OUTPUT_DB=${2:-$SX_DB_DIR/$SX_STRIP_OUTPUT_DB}
REMOVE_LIST=${3:-$SX_STRIP_REMOVE}
KEEP_ID_LIST=${4:-$SX_STRIP_KEEP_ID}
KEEP_LABELS=${5:-$SX_STRIP_KEEP_LABELS}

echo "Arg 1 - Input DB: $INPUT_DB"
echo "Arg 2 - Output DB: $OUTPUT_DB"
echo "Arg 3 - Remove list (locations): $REMOVE_LIST"
echo "Arg 4 - Keep ID list: $KEEP_ID_LIST"
echo "Arg 5 - Keep labels list: $KEEP_LABELS"

# Check if the input database exists
[[ ! -f "$INPUT_DB" ]] && error_exit "Input database $INPUT_DB does not exist"

# Check if the output directory exists, create it if it doesn't
OUTPUT_DIR=$(dirname "$OUTPUT_DB")
if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Output directory $OUTPUT_DIR does not exist, creating it"
    mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory $OUTPUT_DIR"
fi

if [[ ! -d "$SX_HOME_DIR/py-venv" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$SX_HOME_DIR/py-venv"
fi
echo "Activating virtual environment..."
source "$SX_HOME_DIR/py-venv/bin/activate"

pip install -r "$SX_HOME_DIR/Apps/strip_restricted/requirements.txt"

# Run the Python script
cd "$SX_HOME_DIR/Apps/strip_restricted" || error_exit "Failed to change directory to $SX_HOME_DIR/Apps/strip_restricted"
python strip_restricted_nodes.py "$INPUT_DB" "$OUTPUT_DB" --remove_areas="$REMOVE_LIST" --keep_id="$KEEP_ID_LIST" --keep_labels="$KEEP_LABELS" || error_exit "Python script failed"
cd "$ORIGINAL_DIR" || error_exit "Failed to change back to the original directory"
