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

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"

[[ -z "$1" && -z "$SX_STITCH_INSV_FILES_DIR" ]] && error_exit "INSV_PATH is not set"
[[ -z "$2" && -z "$SX_VIDEO_DIR" ]] && error_exit "OUTPUT_VIDEO_DIR is not set"
[[ -z "$3" && -z "$SX_STITCH_RESOLUTION" ]] && error_exit "RESOLUTION is not set"

# Assign variables with priority to CLI arguments
INSV_PATH=${1:-$SX_STITCH_INSV_FILES_DIR}
OUTPUT_VIDEO_DIR=${2:-$SX_VIDEO_DIR}
RESOLUTION=${3:-$SX_STITCH_RESOLUTION}

# Print the values being used
echo "INSV Path: $INSV_PATH"
echo "Output Video Dir: $OUTPUT_VIDEO_DIR"
echo "Resolution: $RESOLUTION"

# Call the stitching function
sx_stitch_insv "$INSV_PATH" "$OUTPUT_VIDEO_DIR" "$RESOLUTION"
check_command "Stitching INSV files into equirectangular"
