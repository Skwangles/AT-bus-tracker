#!/bin/bash

echo "Stitching INSV files to equirectangular mp4"
echo "INSV Path:" ${1:-$CV_STITCH_INSV_FILES_DIR}
echo "Output Video Dir:"  ${2:-$CV_VIDEO_DIR} 
echo "Resolution:" ${3:-$CV_VIDEO_RESOLUTION}

"$CV_HOME_DIR"/ProcessFiles.out ${1:-$CV_STITCH_INSV_FILES_DIR} ${2:-$CV_VIDEO_DIR} ${3:-$CV_VIDEO_RESOLUTION}
