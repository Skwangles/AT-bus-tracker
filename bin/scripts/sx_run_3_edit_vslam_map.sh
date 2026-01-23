#!/bin/bash

echo "EDITING VSLAM MAP"

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

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"
[[ -z "$SX_VSLAM_MAP_DIR" ]] && error_exit "SX_VSLAM_MAP_DIR is not set"

[[ -z "$1" && -z "$SX_VSLAM_MAP_NAME" ]] && error_exit "No input map name provided and SX_VSLAM_MAP_NAME is not set"
[[ -z "$2" && -z "$SX_EDIT_VSLAM_OUTPUT_MAP_NAME" ]] && error_exit "No output map name provided and SX_EDIT_VSLAM_OUTPUT_MAP_NAME is not set"

MAP_IN=${1:-$SX_VSLAM_MAP_NAME}
MAP_OUT=${2:-$SX_EDIT_VSLAM_OUTPUT_MAP_NAME}

echo "Map In:" $MAP_IN
echo "Map Out:" $MAP_OUT

runSitexplorer false $SX_HOME_DIR --in $MAP_IN --out $MAP_OUT --map_dir $SX_VSLAM_MAP_DIR --view_static
check_command "Editing VSLAM map"