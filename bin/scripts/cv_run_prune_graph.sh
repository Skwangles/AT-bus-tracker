#!/bin/bash

echo "Pruning the graph for viewing"

ORIGINAL_DIR=$(pwd)

echo "Table prefix:" ${1:-$CV_GRAPH_PRUNE_TABLE_PREFIX}

cd "$CV_HOME_DIR"/Apps/GraphPruner

if [ "$CV_USE_PRECALCULATED_IMAGE_SHARPNESS" == "true" ]; then
  npm run start -- --img_dir=$CV_KEYFRAME_IMG_DIR --db="$CV_DB_DIR""$CV_DB_NAME" --preproc_sharpness_json=$CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH --table_prefix=${1:-$CV_GRAPH_PRUNE_TABLE_PREFIX}
else 
  npm run start -- --img_dir=$CV_KEYFRAME_IMG_DIR --db="$CV_DB_DIR""$CV_DB_NAME" --table_prefix=${1:-$CV_GRAPH_PRUNE_TABLE_PREFIX}
fi

cd $ORIGINAL_DIR
