#!/bin/bash

echo "Exporting map to SQLite format"
echo "VSLAM Map:" ${1:-$CV_VSLAM_MAP_NAME}
echo "Exported DB:" ${2:-$CV_EXPORTED_DB_NAME}

"$CV_HOME_DIR"/runCampusVirtual true $CV_HOME_DIR --in ${1:-$CV_VSLAM_MAP_NAME} --out ${2:-$CV_EXPORTED_DB_NAME} --map_dir $CV_MAP_DIR --convertToSQLite
