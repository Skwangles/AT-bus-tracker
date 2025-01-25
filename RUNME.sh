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



# Make scripts executable
sudo chmod +x ./bin/scripts/*.sh
check_command "sudo chmod +x ./bin/scripts/*.sh"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

if [ -z "$CV_HOME_DIR" ]; then
  source $SCRIPT_DIR/bin/scripts/cv_run_add_to_path.sh
fi

./bin/scripts/cv_run_copy_env_file.sh
check_command "./bin/scripts/cv_run_copy_env_file.sh"

# Change to the specified directory
cd $CV_HOME_DIR || { echo "Failed to change directory to $CV_HOME_DIR"; exit 1; }

# Optionally build dependencies
# ./BUILD_LIBS.sh # Uncomment if needed
# check_command "./BUILD_LIBS.sh"

echo "Building CampusVirtual Files"
./BUILD_CAMPUS_VIRTUAL.sh
check_command "./BUILD_CAMPUS_VIRTUAL.sh"

# Run the process files script if needed
if [ "$CV_STITCH_INSV_FILES" == true ]; then
  ./bin/scripts/cv_run_process_files.sh
  check_command "./bin/scripts/cv_run_process_files.sh"
fi

# Run the VSLAM map script if needed
if [ "$CV_VSLAM_MAP_VIDEOS" == true ]; then
  ./bin/scripts/cv_run_map.sh
  check_command "./bin/scripts/cv_run_map.sh"
fi

# View the 3D SLAM map if needed
if [ "$CV_EDIT_VSLAM_MAP" == true ]; then
  ./bin/scripts/cv_run_edit_vslam_map.sh
  check_command "./bin/scripts/cv_run_view_vslam_map.sh"
fi

# Export DB if needed
if [ "$CV_EXPORT_DB" == true ]; then
  ./bin/scripts/cv_run_export_sqlite.sh
  check_command "./bin/scripts/cv_run_export_sqlite.sh"
fi

# Pre-calculate image sharpness if needed
if [ "$CV_PRECALCULATE_IMAGE_SHARPNESS" == true ]; then
  ./bin/scripts/cv_run_sharpness_calculate.sh
  check_command "./bin/scripts/cv_run_sharpness_calculate.sh"
fi

# Prune the graph if needed
if [ "$CV_GRAPH_PRUNE" == true ]; then
  ./bin/scripts/cv_run_prune_graph.sh
  check_command "./bin/scripts/cv_run_prune_graph.sh"
fi

# Edit DB visually if needed
if [ "$CV_EDIT_DB_VISUALLY" == true ]; then
  ./bin/scripts/cv_run_edit_db.sh
  check_command "./bin/scripts/cv_run_view_db.sh"
fi

# Extract used images if needed
if [ "$CV_EXTRACT_USED_IMAGES" == true ]; then
  ./bin/scripts/cv_run_extract_images.sh
  check_command "./bin/scripts/cv_run_extract_images.sh"
fi

# Start the server if needed
if [ "$CV_START_SERVER" == true ]; then
  ./bin/scripts/cv_run_start_frontend.sh
  check_command "./bin/scripts/cv_run_start_frontend.sh"
fi

echo "Script completed successfully."
