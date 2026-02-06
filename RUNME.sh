#!/bin/bash

# Exit on error
set -e

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Check if profile name is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <profile_name> [custom_env_file]"
    exit 1
  fi

# Load environment using the new manager
source "$SCRIPT_DIR/bin/scripts/env_manager.sh" "$1" "$2"
check_command "Loading environment configuration"

# Make scripts executable
sudo chmod +x $SX_HOME_DIR/bin/scripts/*.sh
check_command "Making scripts executable"

cd $SX_HOME_DIR || { echo "Failed to change directory to $SX_HOME_DIR"; exit 1; }

# Copy environment files to subdirectories
./bin/scripts/sx_run_0_copy_env_file.sh
check_command "Copying environment files"

# Build dependencies
if [ "$SX_BUILD_LIBS" == true ]; then
  ./BUILD_LIBS.sh
  check_command "Building dependencies"
fi

echo "Building Sitexplorer Files"
  ./BUILD_SITEXPLORER.sh
  check_command "Building Sitexplorer"

# Run features based on configuration
if [ "$SX_STITCH_INSV" == true ]; then
  ./bin/scripts/sx_run_1_process_files.sh
  check_command "Processing files"
fi

if [ "$SX_VSLAM_MAP" == true ]; then
  ./bin/scripts/sx_run_2_map.sh
  check_command "Mapping videos"
fi

if [ "$SX_EDIT_VSLAM" == true ]; then
  ./bin/scripts/sx_run_3_edit_vslam_map.sh
  check_command "Editing VSLAM map"
fi

if [ "$SX_EXPORT_DB" == true ]; then
  ./bin/scripts/sx_run_4_export_sqlite.sh
  check_command "Exporting to SQLite"
fi

if [ "$SX_PRECALCULATE_IMAGE_SHARPNESS" == true ]; then
  ./bin/scripts/sx_run_5_sharpness_calculate.sh
  check_command "Calculating image sharpness"
fi

if [ "$SX_GRAPH_PRUNE" == true ]; then
  ./bin/scripts/sx_run_6_prune_graph.sh
  check_command "Pruning graph"
fi

# Unused for now
# if [ "$SX_MERGE_MAPS" == true ]; then
#   ./bin/scripts/sx_run_7_merge_maps.sh
#   check_command "Merging maps"
# fi

if [ "$SX_EDIT_DB_VISUALLY" == true ]; then
  ./bin/scripts/sx_run_8_edit_db.sh
  check_command "Editing database visually"
fi

if [ "$SX_INIT_DATA" == true ]; then
  ./bin/scripts/sx_run_9_init_data.sh
  check_command "Initializing data"
fi

if [ "$SX_START_AUTHORING" == true ]; then
  ./bin/scripts/sx_run_10_start_authoring.sh
  check_command "Starting authoring system"
fi

if [ "$SX_STRIP_RESTRICTED_NODES" == true ]; then
  ./bin/scripts/sx_run_11_strip_restricted_locations.sh
  check_command "Stripping restricted locations"
fi

if [ "$SX_EXTRACT_USED_IMAGES" == true ]; then
  ./bin/scripts/sx_run_12_extract_images.sh
  check_command "Extracting used images"
fi

if [ "$SX_EXPORT_FILES" == true ]; then
  ./bin/scripts/sx_run_13_export.sh
  check_command "Exporting DB and Floorplan images to client directory"
fi

if [ "$SX_EXPORT_TO_POSTGRES" == true ]; then
  ./bin/scripts/sx_run_14_export-to-postgres.sh
  check_command "Exporting SQLite database to PostgreSQL"
fi

echo "Script completed successfully."
