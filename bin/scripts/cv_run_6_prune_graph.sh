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

echo "PRUNING GRAPH WITH GRID-BASED PYTHON METHOD"

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"
[[ -z "$SX_DB_DIR" ]] && error_exit "SX_DB_DIR is not set"
[[ -z "$SX_PRUNE_DB_NAME" ]] && error_exit "SX_PRUNE_DB_NAME is not set"
[[ -z "$SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH is not set"
# Optional parameters with defaults
GRID_SIZE="${SX_PRUNE_GRID_SIZE:-5.0}"
GRID_SIZE_Y="${SX_PRUNE_GRID_SIZE_Y:-2.0}"
COORDS_TO_METRES="${SX_PRUNE_COORDS_TO_METRES:-15.0}"
VERBOSE="${SX_PRUNE_VERBOSE:-false}"

ORIGINAL_DIR=$(pwd)

echo "Database: $SX_DB_DIR$SX_PRUNE_DB_NAME"
echo "Sharpness JSON: $SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH"
echo "Grid size: ${GRID_SIZE}m"
echo "Coordinate scaling: ${COORDS_TO_METRES}x"
echo "Verbose: $VERBOSE"

cd "$SX_HOME_DIR"/Apps/GraphProcessor || error_exit "Failed to change directory to $SX_HOME_DIR/Apps/GraphProcessor"

# Check if Python dependencies are installed
echo "Checking Python dependencies..."
if [[ ! -d "$SX_HOME_DIR/py-venv" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$SX_HOME_DIR/py-venv"
  python -m ensurepip --default-pip
fi
echo "Activating virtual environment..."
source "$SX_HOME_DIR/py-venv/bin/activate"

python -c "import numpy, networkx, scipy, sklearn, tqdm" 2>/dev/null || {
    echo "Installing Python dependencies..."
    pip install -r "$SX_HOME_DIR/Apps/GraphProcessor/requirements.txt"
}

# Run the grid-based pruning
VERBOSE_FLAG=""
[[ "$VERBOSE" == "true" ]] && VERBOSE_FLAG="--verbose"
echo "$COORDS_TO_METRES"

python run_pruning.py prune "$SX_DB_DIR$SX_PRUNE_DB_NAME" --sharpness-json "$SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" --grid-size "$GRID_SIZE" --grid-size-y "$GRID_SIZE_Y" --coords-to-metres "$COORDS_TO_METRES" $VERBOSE_FLAG
check_command "Pruning graph with grid-based method"

cd "$ORIGINAL_DIR" || error_exit "Failed to change directory back to $ORIGINAL_DIR"

echo "Graph pruning completed successfully!"
echo "Results saved to: $SX_DB_DIR/pruned_$SX_PRUNE_DB_NAME"
