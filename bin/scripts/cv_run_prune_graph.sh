#!/bin/bash
echo "PRUNING"


# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_PRUNE_TABLE_PREFIX" || -z "$CV_KEYFRAME_IMG_DIR" || -z "$CV_DB_DIR" || -z "$CV_PRUNE_DB_NAME" || -z "$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

ORIGINAL_DIR=$(pwd)

echo "Table prefix:" ${1:-$CV_PRUNE_TABLE_PREFIX}

cd "$CV_HOME_DIR"/Apps/GraphPruner

if [ "$CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS" == "true" ]; then
  npm run start -- --img_dir=$CV_KEYFRAME_IMG_DIR --db="$CV_DB_DIR$CV_PRUNE_DB_NAME" --preproc_sharpness_json=$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH --table_prefix=${1:-$CV_PRUNE_TABLE_PREFIX}
else 
  npm run start -- --img_dir=$CV_KEYFRAME_IMG_DIR --db="$CV_DB_DIR$CV_PRUNE_DB_NAME" --table_prefix=${1:-$CV_PRUNE_TABLE_PREFIX}
fi

cd $ORIGINAL_DIR
