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

echo "PRECALCULATING SHARPNESS"

# Check if the required inputs are provided as arguments or environment variables
CV_HOME_DIR=${1:-$CV_HOME_DIR}
CV_KEYFRAME_IMG_DIR=${2:-$CV_KEYFRAME_IMG_DIR}
CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH=${3:-$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH}

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "CV_KEYFRAME_IMG_DIR is not set"
[[ -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH is not set"

ORIGINAL_DIR=$(pwd)

cd "$CV_HOME_DIR"/Apps/SharpnessCalculator || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/SharpnessCalculator"

# Create virtual environment if it doesn't exist
VENV_DIR="venv"
if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR" || error_exit "Failed to create virtual environment"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate" || error_exit "Failed to activate virtual environment"

echo "Installing required Python packages for Sharpness Calculator"
pip3 install -r requirements.txt || error_exit "Failed to install required Python packages"

echo "Running Sharpness Calculator"
python3 main.py sharpness "$CV_KEYFRAME_IMG_DIR" "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" || error_exit "Failed to run Sharpness Calculator"
check_command "Running Sharpness Calculator"

# Deactivate virtual environment
deactivate

cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"