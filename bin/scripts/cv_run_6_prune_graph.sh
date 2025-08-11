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

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_DB_DIR" ]] && error_exit "CV_DB_DIR is not set"
[[ -z "$CV_PRUNE_DB_NAME" ]] && error_exit "CV_PRUNE_DB_NAME is not set"

# Optional parameters with defaults
GRID_SIZE="${CV_PRUNE_GRID_SIZE:-5.0}"
COORDS_TO_METRES="${CV_PRUNE_COORDS_TO_METRES:-15.0}"
VERBOSE="${CV_PRUNE_VERBOSE:-false}"

ORIGINAL_DIR=$(pwd)

echo "Database: $CV_DB_DIR$CV_PRUNE_DB_NAME"
echo "Grid size: ${GRID_SIZE}m"
echo "Coordinate scaling: ${COORDS_TO_METRES}x"
echo "Verbose: $VERBOSE"

cd "$CV_HOME_DIR"/Apps/GraphProcessor || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/GraphProcessor"

# Check if Python dependencies are installed
echo "Checking Python dependencies..."
python -c "import numpy, networkx, scipy, sklearn, tqdm" 2>/dev/null || {
    echo "Installing Python dependencies..."
    pip install numpy networkx scipy scikit-learn tqdm matplotlib
}

# Run the grid-based pruning
VERBOSE_FLAG=""
[[ "$VERBOSE" == "true" ]] && VERBOSE_FLAG="--verbose"

python run_pruning.py prune "$CV_DB_DIR$CV_PRUNE_DB_NAME" --grid-size "$GRID_SIZE" --coords-to-metres "$COORDS_TO_METRES" $VERBOSE_FLAG
check_command "Pruning graph with grid-based method"

cd "$ORIGINAL_DIR" || error_exit "Failed to change directory back to $ORIGINAL_DIR"

echo "Graph pruning completed successfully!"
echo "Results saved to: $CV_DB_DIR/grid_$CV_PRUNE_DB_NAME"
