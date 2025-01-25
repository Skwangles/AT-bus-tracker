#!/bin/bash
echo "EXPORTING VSLAM MAP TO SQLITE"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_VSLAM_MAP_NAME" || -z "$CV_EXPORT_DB_NAME" || -z "$CV_VSLAM_MAP_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

echo "VSLAM Map:" ${1:-$CV_VSLAM_MAP_NAME}
echo "Exported DB:" ${2:-$CV_EXPORT_DB_NAME}

runCampusVirtual true $CV_HOME_DIR --in ${1:-$CV_VSLAM_MAP_NAME} --export_path ${2:-$CV_DB_DIR$CV_EXPORT_DB_NAME} --map_dir $CV_VSLAM_MAP_DIR --convertToSQLite
