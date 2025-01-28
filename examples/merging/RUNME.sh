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

$SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.video1
$SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.video2
$SCRIPT_DIR/../../RUNME.sh $SCRIPT_DIR/.env.justmerge
