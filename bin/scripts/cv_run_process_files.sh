#!/bin/bash
echo "STITCHING INSV FILES INTO EQUIRECTANGULAR"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_STITCH_INSV_FILES_DIR" || -z "$CV_VIDEO_DIR" || -z "$CV_STITCH_RESOLUTION" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

echo "INSV Path:" ${1:-$CV_STITCH_INSV_FILES_DIR}
echo "Output Video Dir:"  ${2:-$CV_VIDEO_DIR} 
echo "Resolution:" ${3:-$CV_STITCH_RESOLUTION}

cv_stitch_insv ${1:-$CV_STITCH_INSV_FILES_DIR} ${2:-$CV_VIDEO_DIR} ${3:-$CV_STITCH_RESOLUTION}
