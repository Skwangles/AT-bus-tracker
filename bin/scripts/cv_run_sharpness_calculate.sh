#!/bin/bash
echo "PRECALCULATING SHARPNESS"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_KEYFRAME_IMG_DIR" || -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

ORIGINAL_DIR=$(pwd)

cd "$CV_HOME_DIR"/Apps/SharpnessCalculator
echo "Setting up Python environment"
python3 -m venv ./env
source ./env/bin/activate

echo "Installing required Python packages for Sharpness Calculator"
pip3 install -r requirements.txt

echo "Running Sharpness Calculator"
python3 sharpness.py $CV_KEYFRAME_IMG_DIR $CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH
cd $ORIGINAL_DIR