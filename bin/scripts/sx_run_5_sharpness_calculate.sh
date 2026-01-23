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
SX_HOME_DIR=${1:-$SX_HOME_DIR}
SX_KEYFRAME_IMG_DIR=${2:-$SX_KEYFRAME_IMG_DIR}
SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH=${3:-$SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH}

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"
[[ -z "$SX_KEYFRAME_IMG_DIR" ]] && error_exit "SX_KEYFRAME_IMG_DIR is not set"
[[ -z "$SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH is not set"

ORIGINAL_DIR=$(pwd)

cd "$SX_HOME_DIR"/Apps/SharpnessCalculator || error_exit "Failed to change directory to $SX_HOME_DIR/Apps/SharpnessCalculator"

# Create virtual environment if it doesn't exist
VENV_DIR="venv"
if [[ ! -d "$VENV_DIR" ]]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR" || error_exit "Failed to create virtual environment"
    python -m ensurepip --default-pip
fi

# Activate virtual environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate" || error_exit "Failed to activate virtual environment"

echo "Installing required Python packages for Sharpness Calculator"
python -m ensurepip --default-pip
pip install -r requirements.txt || error_exit "Failed to install required Python packages"

echo "Running Sharpness Calculator"
python3 main.py sharpness "$SX_KEYFRAME_IMG_DIR" "$SX_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" || error_exit "Failed to run Sharpness Calculator"
check_command "Running Sharpness Calculator"

# Deactivate virtual environment
deactivate

cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"