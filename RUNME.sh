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

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

source $SCRIPT_DIR/SOURCE_SETUP.sh

if [ -z "$CV_HOME_DIR" ]; then
  echo "Failed to add environment variables to path - please look at cv_run_add_to_path.sh"
  exit 1
fi

sudo chmod +x $CV_HOME_DIR/bin/scripts/*.sh
check_command "sudo chmod +x $CV_HOME_DIR/bin/scripts/*.sh"

cd $CV_HOME_DIR || { echo "Failed to change directory to $CV_HOME_DIR"; exit 1; }

./bin/scripts/cv_run_0_copy_env_file.sh
check_command "./bin/scripts/cv_run_copy_env_file.sh"

# Optionally build dependencies
./BUILD_LIBS.sh
check_command "./BUILD_LIBS.sh"

echo "Building CampusVirtual Files"
./BUILD_CAMPUS_VIRTUAL.sh
check_command "./BUILD_CAMPUS_VIRTUAL.sh"

if [ "$CV_STITCH_INSV_FILES" == true ]; then
  ./bin/scripts/cv_run_1_process_files.sh
  check_command "./bin/scripts/cv_run_process_files.sh"
fi

if [ "$CV_VSLAM_MAP_VIDEOS" == true ]; then
  ./bin/scripts/cv_run_2_map.sh
  check_command "./bin/scripts/cv_run_map.sh"
fi

if [ "$CV_EDIT_VSLAM_MAP" == true ]; then
  ./bin/scripts/cv_run_3_edit_vslam_map.sh
  check_command "./bin/scripts/cv_run_view_vslam_map.sh"
fi

if [ "$CV_EXPORT_DB" == true ]; then
  ./bin/scripts/cv_run_4_export_sqlite.sh
  check_command "./bin/scripts/cv_run_export_sqlite.sh"
fi

if [ "$CV_PRECALCULATE_IMAGE_SHARPNESS" == true ]; then
  ./bin/scripts/cv_run_5_sharpness_calculate.sh
  check_command "./bin/scripts/cv_run_sharpness_calculate.sh"
fi

if [ "$CV_GRAPH_PRUNE" == true ]; then
  ./bin/scripts/cv_run_6_prune_graph.sh
  check_command "./bin/scripts/cv_run_prune_graph.sh"
fi

if [ "$CV_MERGE_MAPS" == true ]; then
  ./bin/scripts/cv_run_7_merge_maps.sh
  check_command "./bin/scripts/cv_run_merge_maps.sh"
fi

if [ "$CV_EDIT_DB_VISUALLY" == true ]; then
  ./bin/scripts/cv_run_8_edit_db.sh
  check_command "./bin/scripts/cv_run_view_db.sh"
fi

if [ "$CV_EXTRACT_USED_IMAGES" == true ]; then
  ./bin/scripts/cv_run_9_extract_images.sh
  check_command "./bin/scripts/cv_run_extract_images.sh"
fi

if [ "$CV_START_SERVER" == true ]; then
  ./bin/scripts/cv_run_10_start_frontend.sh
  check_command "./bin/scripts/cv_run_start_frontend.sh"
fi

echo "Script completed successfully."
