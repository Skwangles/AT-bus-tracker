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

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"
[[ -z "$SX_VSLAM_MAP_DIR" ]] && error_exit "SX_VSLAM_MAP_DIR is not set"
[[ -z "$SX_VSLAM_CONFIG_FILE" ]] && error_exit "SX_VSLAM_CONFIG_FILE is not set"

echo $SX_EXPORT_IN_MAP_NAME
[[ -z "$1" && -z "$SX_EXPORT_IN_MAP_NAME" ]] && error_exit "Input map name is not provided"
[[ -z "$2" && -z "$SX_EXPORT_DB_NAME" ]] && error_exit "Exported DB name is not provided"

echo "VSLAM Map:" ${1:-$SX_EXPORT_IN_MAP_NAME}
echo "Exported DB:" ${2:-$SX_EXPORT_DB_NAME}

runSitexplorer true $SX_HOME_DIR --in ${1:-$SX_EXPORT_IN_MAP_NAME} --export_path ${2:-$SX_DB_DIR$SX_EXPORT_DB_NAME} --map_dir $SX_VSLAM_MAP_DIR --convertToSQLite --config_file $SX_VSLAM_CONFIG_FILE
check_command "Exporting VSLAM map to SQLite"