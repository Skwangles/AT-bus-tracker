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
CV_PRECALCULATE_HISTOGRAM_JSON_PATH=${4:-$CV_PRECALCULATE_HISTOGRAM_JSON_PATH}

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "CV_KEYFRAME_IMG_DIR is not set"
[[ -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH is not set"
[[ -z "$CV_PRECALCULATE_HISTOGRAM_JSON_PATH" ]] && error_exit "CV_PRECALCULATE_HISTOGRAM_JSON_PATH is not set"

ORIGINAL_DIR=$(pwd)

cd "$CV_HOME_DIR"/Apps/SharpnessCalculator || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/SharpnessCalculator"

# Check if the Python virtual environment exists and is valid
if [ ! -f "./env/bin/pip3" ]; then
  echo "Python virtual environment not found or broken. Creating a new one."
  python3 -m venv ./env || error_exit "Failed to create virtual environment"
  source ./env/bin/activate || error_exit "Failed to activate virtual environment"
  echo "Installing required Python packages for Sharpness Calculator"
  pip3 install -r requirements.txt || error_exit "Failed to install required Python packages"
else
  echo "Using existing Python virtual environment."
  source ./env/bin/activate || error_exit "Failed to activate virtual environment"
fi

python -m pip install -r requirements.txt || error_exit "Failed to install required Python packages"

echo "Running Sharpness Calculator (sharpness values)"
python3 main.py sharpness "$CV_KEYFRAME_IMG_DIR" "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" || error_exit "Failed to run Sharpness Calculator (sharpness)"
check_command "Running Sharpness Calculator (sharpness)"

echo "Running Sharpness Calculator (histogram export)"
python3 main.py histogram "$CV_KEYFRAME_IMG_DIR" "$CV_PRECALCULATE_HISTOGRAM_JSON_PATH" || error_exit "Failed to run Sharpness Calculator (histogram export)"
check_command "Running Sharpness Calculator (histogram export)"

cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"