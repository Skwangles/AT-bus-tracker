#!/bin/bash
echo "COPYING IMAGES FROM DB TO NEW DIR"

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

ORIGINAL_DIR=$(pwd)

# Check if CV_HOME_DIR is set
[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR environment variable is not set"

# Check if the required inputs are empty
[[ -z "$1" && -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "Input directory is not provided as an argument or environment variable"
[[ -z "$2" && -z "$CV_EXTRACT_USED_IMAGES_DIR" ]] && error_exit "Output directory is not provided as an argument or environment variable"
[[ -z "$3" && ( -z "$CV_EXTRACT_IN_DB_NAME" || -z "$CV_DB_DIR" ) ]] && error_exit "Input DB is not provided as an argument or environment variable"

INPUT_DIR=${1:-$CV_KEYFRAME_IMG_DIR}
OUTPUT_DIR=${2:-$CV_EXTRACT_USED_IMAGES_DIR}
INPUT_DB=${3:-$CV_DB_DIR/$CV_EXTRACT_IN_DB_NAME}
FACE_BLUR=${4:-$CV_EXTRACT_FACE_BLUR}
echo "Arg 1 - Input dir: $INPUT_DIR"
echo "Arg 2 - Output dir: $OUTPUT_DIR"
echo "Arg 3 - In DB name: $INPUT_DB"
echo "Arg 4 - Face blur: $FACE_BLUR"

# Check if the input directory exists
[[ ! -d "$INPUT_DIR" ]] && error_exit "Input directory $INPUT_DIR does not exist"

# Check if the output directory exists, create if it doesn't
if [[ ! -d "$OUTPUT_DIR" ]]; then
    echo "Output directory $OUTPUT_DIR does not exist, creating it"
    mkdir -p "$OUTPUT_DIR" || error_exit "Failed to create output directory $OUTPUT_DIR"
fi

cd "$CV_HOME_DIR/Apps/ImageProcessor" || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/ImageProcessor"

# Create virtual environment if it doesn't exist
echo "Checking Python dependencies..."
if [[ ! -d "$CV_HOME_DIR/py-venv" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$CV_HOME_DIR/py-venv"
  python -m ensurepip --default-pip
fi
echo "Activating virtual environment..."
source "$CV_HOME_DIR/py-venv/bin/activate"

echo "Installing Python dependencies..."
python -m ensurepip --default-pip
pip install -r requirements.txt || error_exit "pip install failed"

# Run the Python image splitter
echo "Running Python image splitter..."
python image_processor.py db "$INPUT_DB" "$INPUT_DIR" "$OUTPUT_DIR" --face_blur || error_exit "Python image splitter failed"

# Deactivate virtual environment
deactivate

cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"
