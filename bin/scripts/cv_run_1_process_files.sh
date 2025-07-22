#!/bin/bash

echo "STITCHING INSV FILES INTO EQUIRECTANGULAR"

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

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"

[[ -z "$1" && -z "$CV_STITCH_INSV_FILES_DIR" ]] && error_exit "INSV_PATH is not set"
[[ -z "$2" && -z "$CV_VIDEO_DIR" ]] && error_exit "OUTPUT_VIDEO_DIR is not set"
[[ -z "$3" && -z "$CV_STITCH_RESOLUTION" ]] && error_exit "RESOLUTION is not set"

# Assign variables with priority to CLI arguments
INSV_PATH=${1:-$CV_STITCH_INSV_FILES_DIR}
OUTPUT_VIDEO_DIR=${2:-$CV_VIDEO_DIR}
RESOLUTION=${3:-$CV_STITCH_RESOLUTION}

# Print the values being used
echo "INSV Path: $INSV_PATH"
echo "Output Video Dir: $OUTPUT_VIDEO_DIR"
echo "Resolution: $RESOLUTION"

# Call the stitching function
cv_stitch_insv "$INSV_PATH" "$OUTPUT_VIDEO_DIR" "$RESOLUTION"
check_command "Stitching INSV files into equirectangular"

# Optionally export global histogram/CDF for keyframe images using config variables
if [ "$CV_PRECALCULATE_EXPORT_HISTOGRAM" = "true" ]; then
  # CV_PRECALCULATE_IMAGE_DIR and CV_PRECALCULATE_HISTOGRAM_JSON_PATH must be set
  if [ -z "$CV_PRECALCULATE_IMAGE_DIR" ]; then
    error_exit "CV_PRECALCULATE_IMAGE_DIR is not set for histogram export"
  fi
  if [ -z "$CV_PRECALCULATE_HISTOGRAM_JSON_PATH" ]; then
    error_exit "CV_PRECALCULATE_HISTOGRAM_JSON_PATH is not set for histogram export"
  fi
  echo "Exporting global histogram/CDF for images in $CV_PRECALCULATE_IMAGE_DIR to $CV_PRECALCULATE_HISTOGRAM_JSON_PATH"
  python3 "$CV_HOME_DIR/Apps/SharpnessCalculator/main.py" histogram "$CV_PRECALCULATE_IMAGE_DIR" "$CV_PRECALCULATE_HISTOGRAM_JSON_PATH"
  check_command "Exporting histogram/CDF JSON"
fi

