#!/bin/bash

echo "Viewing 3D SLAM map"

MAP_IN=${1:-$CV_VSLAM_MAP_NAME}
MAP_OUT=${2:-$CV_EDIT_VSLAM_OUTPUT_MAP_NAME}

echo "Map In:" $MAP_IN
echo "Map Out:" $MAP_OUT

"$CV_HOME_DIR"/runCampusVirtual false $CV_HOME_DIR --in $MAP_IN --out $MAP_OUT --map_dir $CV_VSLAM_MAP_DIR --view_static
