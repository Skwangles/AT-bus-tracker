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

if [ -z "$CV_HOME_DIR" ]; then
  source $SCRIPT_DIR/../../SOURCE_SETUP.sh
fi

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
./BUILD_LIBS.sh # Uncomment if needed
check_command "./BUILD_LIBS.sh"

echo "Building CampusVirtual Files"
./BUILD_CAMPUS_VIRTUAL.sh
check_command "./BUILD_CAMPUS_VIRTUAL.sh"

# Run the VSLAM map script if needed
if [ "$CV_VSLAM_MAP_VIDEOS" == true ]; then
  ./bin/scripts/cv_run_2_map.sh $EXAMPLE_SCRIPT_VIDEOS_1_COMMA_SEPARATED_NAMES $EXAMPLE_SCRIPT_FIRST_MAP_NAME
  check_command "./bin/scripts/cv_run_map.sh - First step"
  ./bin/scripts/cv_run_2_map.sh $CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES $CV_VSLAM_MAP_NAME $EXAMPLE_SCRIPT_FIRST_MAP_NAME
  check_command "./bin/scripts/cv_run_map.sh - Second step"
fi

echo "Script completed successfully."
