#!/bin/bash

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

echo "RUNNING INIT DATA"

# Check if the required inputs are provided as arguments or environment variables
if [[ -z "$SX_HOME_DIR" ]]; then
    error_exit "SX_HOME_DIR is not set"
fi

cd "$SX_HOME_DIR"/Apps/meta_data_init || error_exit "Failed to change directory"
npm run build || error_exit "Failed to build the project"
npm run start || error_exit "Failed to start the project"
