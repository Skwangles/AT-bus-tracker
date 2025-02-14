#!/bin/bash

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

echo "PRUNING"

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "CV_KEYFRAME_IMG_DIR is not set"
[[ -z "$CV_DB_DIR" ]] && error_exit "CV_DB_DIR is not set"
[[ -z "$CV_PRUNE_DB_NAME" ]] && error_exit "CV_PRUNE_DB_NAME is not set"
[[ -z "$CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS" && -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "Either CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS or CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH must be provided"
[[ -z "$1" && -z "$CV_PRUNE_TABLE_PREFIX" ]] && error_exit "Either CLI argument or CV_PRUNE_TABLE_PREFIX must be provided"
TABLE_PREFIX="${1:-$CV_PRUNE_TABLE_PREFIX}"

ORIGINAL_DIR=$(pwd)

echo "Arg 1 -Table prefix:" ${1:-$CV_PRUNE_TABLE_PREFIX}

cd "$CV_HOME_DIR"/Apps/GraphPruner || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/GraphPruner"

OPTION=""
[[ -n "$CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS" ]] && OPTION="--preproc_sharpness_json=\"$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH\""

npm run start -- --img_dir="$CV_KEYFRAME_IMG_DIR" --db="$CV_DB_DIR$CV_PRUNE_DB_NAME" $OPTION --table_prefix="${1:-$CV_PRUNE_TABLE_PREFIX}"
check_command "Pruning graph"

cd "$ORIGINAL_DIR" || error_exit "Failed to change directory back to $ORIGINAL_DIR"
