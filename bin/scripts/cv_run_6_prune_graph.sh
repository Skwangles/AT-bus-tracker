#!/bin/bash

function error_exit {
  echo "Error: $1"
  exit 1
}

echo "PRUNING"

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "CV_KEYFRAME_IMG_DIR is not set"
[[ -z "$CV_DB_DIR" ]] && error_exit "CV_DB_DIR is not set"
[[ -z "$CV_PRUNE_DB_NAME" ]] && error_exit "CV_PRUNE_DB_NAME is not set"
[[ -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]] && error_exit "CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH is not set"

[[ -z "$1" && -z "$CV_PRUNE_TABLE_PREFIX" ]] && error_exit "Either CLI argument or CV_PRUNE_TABLE_PREFIX must be provided"

ORIGINAL_DIR=$(pwd)

echo "Table prefix:" ${1:-$CV_PRUNE_TABLE_PREFIX}

cd "$CV_HOME_DIR"/Apps/GraphPruner || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/GraphPruner"

OPTION=""
[[ -n "$CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS" ]] && OPTION="--preproc_sharpness_json=\"$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH\""

npm run start -- --img_dir="$CV_KEYFRAME_IMG_DIR" --db="$CV_DB_DIR$CV_PRUNE_DB_NAME" $OPTION --table_prefix="${1:-$CV_PRUNE_TABLE_PREFIX}"

cd "$ORIGINAL_DIR" || error_exit "Failed to change directory back to $ORIGINAL_DIR"
