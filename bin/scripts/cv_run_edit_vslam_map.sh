#!/bin/bash

echo "EDITING VSLAM MAP"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_VSLAM_MAP_NAME" || -z "$CV_EDIT_VSLAM_OUTPUT_MAP_NAME" || -z "$CV_VSLAM_MAP_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

MAP_IN=${1:-$CV_VSLAM_MAP_NAME}
MAP_OUT=${2:-$CV_EDIT_VSLAM_OUTPUT_MAP_NAME}



echo "Map In:" $MAP_IN
echo "Map Out:" $MAP_OUT

runCampusVirtual false $CV_HOME_DIR --in $MAP_IN --out $MAP_OUT --map_dir $CV_VSLAM_MAP_DIR --view_static
