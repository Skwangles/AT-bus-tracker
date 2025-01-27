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

# $SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.video1
# $SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.video2
$SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.justmerge

source $SCRIPT_DIR/../../SOURCE_SETUP.sh $SCRIPT_DIR/.env.video2
echo "CV_HOME_DIR: $CV_HOME_DIR"
# export CV_HOME_DIR=$SCRIPT_DIR/../../
$CV_HOME_DIR/bin/scripts/cv_run_8_edit_db.sh $CV_DB_DIR/zone-1.db None &
$CV_HOME_DIR/bin/scripts/cv_run_8_edit_db.sh $CV_DB_DIR/zone-2.db None &
$CV_HOME_DIR/bin/scripts/cv_run_8_edit_db.sh $CV_DB_DIR/output-zones.db refined_ &