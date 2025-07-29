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
sudo chmod +x $CV_HOME_DIR/bin/scripts/*.sh
check_command "Making scripts executable"

cd $CV_HOME_DIR || { echo "Failed to change directory to $CV_HOME_DIR"; exit 1; }

# Copy environment files to subdirectories
./bin/scripts/cv_run_0_copy_env_file.sh
check_command "Copying environment files"

# Build dependencies
if [ "$CV_BUILD_LIBS" == true ]; then
  ./BUILD_LIBS.sh
  check_command "Building dependencies"
fi

echo "Building Sitexplorer Files"
./BUILD_SITEXPLORER.sh
check_command "Building Sitexplorer"

# Run features based on configuration
if [ "$CV_STITCH_INSV" == true ]; then
  ./bin/scripts/cv_run_1_process_files.sh
  check_command "Processing files"
fi

if [ "$CV_VSLAM_MAP" == true ]; then
  ./bin/scripts/cv_run_2_map.sh
  check_command "Mapping videos"
fi

if [ "$CV_EDIT_VSLAM" == true ]; then
  ./bin/scripts/cv_run_3_edit_vslam_map.sh
  check_command "Editing VSLAM map"
fi

if [ "$CV_EXPORT_DB" == true ]; then
  ./bin/scripts/cv_run_4_export_sqlite.sh
  check_command "Exporting to SQLite"
fi

if [ "$CV_PRECALCULATE_IMAGE_SHARPNESS" == true ]; then
  ./bin/scripts/cv_run_5_sharpness_calculate.sh
  check_command "Calculating image sharpness"
fi

if [ "$CV_GRAPH_PRUNE" == true ]; then
  ./bin/scripts/cv_run_6_prune_graph.sh
  check_command "Pruning graph"
fi

if [ "$CV_MERGE_MAPS" == true ]; then
  ./bin/scripts/cv_run_7_merge_maps.sh
  check_command "Merging maps"
fi

if [ "$CV_EDIT_DB_VISUALLY" == true ]; then
  ./bin/scripts/cv_run_8_edit_db.sh
  check_command "Editing database visually"
fi

if [ "$CV_INIT_DATA" == true ]; then
  ./bin/scripts/cv_run_9_init_data.sh
  check_command "Initializing data"
fi

if [ "$CV_START_AUTHORING" == true ]; then
  ./bin/scripts/cv_run_10_start_authoring.sh
  check_command "Starting authoring system"
fi

if [ "$CV_STRIP_RESTRICTED_NODES" == true ]; then
  ./bin/scripts/cv_run_11_strip_restricted_locations.sh
  check_command "Stripping restricted locations"
fi

if [ "$CV_EXTRACT_USED_IMAGES" == true ]; then
  ./bin/scripts/cv_run_12_extract_images.sh
  check_command "Extracting used images"
fi

if [ "$CV_START_SERVER" == true ]; then
  ./bin/scripts/cv_run_13_export.sh
  check_command "Exporting DB and Floorplan images to client directory"
fi

echo "Script completed successfully."
