#!/bin/bash

echo "Extracting only the images we need"
ORIGINAL_DIR=$(pwd)
cd $CV_HOME_DIR/Apps/ImageSplitter
npm install
npm run build
npm run start -- --input_dir=${1:-$CV_PICTURE_DIR} --output_dir=${2:-$CV_EXTRACT_USED_IMAGES_DIR}
cd $ORIGINAL_DIR
