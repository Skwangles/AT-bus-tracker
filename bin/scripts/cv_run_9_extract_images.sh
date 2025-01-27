#!/bin/bash
echo "COPYING IMAGES FROM DB TO NEW DIR"

function error_exit {
    echo "Error: $1"
    exit 1
}

ORIGINAL_DIR=$(pwd)

# Check if CV_HOME_DIR is set
[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR environment variable is not set"

# Check if the required inputs are empty
[[ -z "$1" && -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "Input directory is not provided as an argument or environment variable"
[[ -z "$2" && -z "$CV_EXTRACT_USED_IMAGES_DIR" ]] && error_exit "Output directory is not provided as an argument or environment variable"

INPUT_DIR=${1:-$CV_KEYFRAME_IMG_DIR}
OUTPUT_DIR=${2:-$CV_EXTRACT_USED_IMAGES_DIR}
echo "Arg 1 - Input dir: $INPUT_DIR"
echo "Arg 2 - Output dir: $OUTPUT_DIR"

# Check if the input directory exists
[[ ! -d "$INPUT_DIR" ]] && error_exit "Input directory $INPUT_DIR does not exist"

# Check if the output directory exists, create if it doesn't
if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Output directory $OUTPUT_DIR does not exist, creating it"
    mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory $OUTPUT_DIR"
fi

cd "$CV_HOME_DIR/Apps/ImageSplitter" || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/ImageSplitter"
npm install || error_exit "npm install failed"
npm run build || error_exit "npm run build failed"
npm run start -- --input_dir="$INPUT_DIR" --output_dir="$OUTPUT_DIR" || error_exit "npm run start failed"
cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"
