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

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_VSLAM_MAP_DIR" ]] && error_exit "CV_VSLAM_MAP_DIR is not set"

[[ -z "$1" && -z "$CV_VSLAM_MAP_NAME" ]] && error_exit "No input map name provided and CV_VSLAM_MAP_NAME is not set"
[[ -z "$2" && -z "$CV_EDIT_VSLAM_OUTPUT_MAP_NAME" ]] && error_exit "No output map name provided and CV_EDIT_VSLAM_OUTPUT_MAP_NAME is not set"

MAP_IN=${1:-$CV_VSLAM_MAP_NAME}
MAP_OUT=${2:-$CV_EDIT_VSLAM_OUTPUT_MAP_NAME}

echo "Map In:" $MAP_IN
echo "Map Out:" $MAP_OUT

runCampusVirtual false $CV_HOME_DIR --in $MAP_IN --out $MAP_OUT --map_dir $CV_VSLAM_MAP_DIR --view_static
check_command "Editing VSLAM map"