#!/bin/bash

ORIGINAL_DIR=$(pwd)

cd "$CV_HOME_DIR"/Apps/SharpnessCalculator
echo "Setting up Python environment"
python3 -m venv ./env
source ./env/bin/activate

echo "Installing required Python packages for Sharpness Calculator"
pip3 install pillow

echo "Running Sharpness Calculator"
python3 sharpness.py $CV_KEYFRAME_IMG_DIR $CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH
cd $ORIGINAL_DIR