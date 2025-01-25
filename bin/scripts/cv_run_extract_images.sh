#!/bin/bash
echo "COPYING IMAGES FROM DB TO NEW DIR"

ORIGINAL_DIR=$(pwd)
# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_KEYFRAME_IMG_DIR" || -z "$CV_EXTRACT_USED_IMAGES_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

cd $CV_HOME_DIR/Apps/ImageSplitter
npm install
npm run build
npm run start -- --input_dir=${1:-$CV_KEYFRAME_IMG_DIR} --output_dir=${2:-$CV_EXTRACT_USED_IMAGES_DIR}
cd $ORIGINAL_DIR
