#!/bin/bash
echo "EXPORTING VSLAM MAP TO SQLITE"

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
[[ -z "$CV_VSLAM_CONFIG_FILE" ]] && error_exit "CV_VSLAM_CONFIG_FILE is not set"

echo $CV_EXPORT_IN_MAP_NAME
[[ -z "$1" && -z "$CV_EXPORT_IN_MAP_NAME" ]] && error_exit "Input map name is not provided"
[[ -z "$2" && -z "$CV_EXPORT_DB_NAME" ]] && error_exit "Exported DB name is not provided"

echo "VSLAM Map:" ${1:-$CV_EXPORT_IN_MAP_NAME}
echo "Exported DB:" ${2:-$CV_EXPORT_DB_NAME}

runSitexplorer true $CV_HOME_DIR --in ${1:-$CV_EXPORT_IN_MAP_NAME} --export_path ${2:-$CV_DB_DIR$CV_EXPORT_DB_NAME} --map_dir $CV_VSLAM_MAP_DIR --convertToSQLite --config_file $CV_VSLAM_CONFIG_FILE
check_command "Exporting VSLAM map to SQLite"