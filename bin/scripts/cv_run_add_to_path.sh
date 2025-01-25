#!/bin/bash
echo "ADDING TO PATH"

if [ ! -f .env ]; then
  echo ".env not found - You MUST rename .env.example to .env and customise it!"
  echo "Aborting so you don't accidentally use the wrong config!"
  exit 1
fi

source .env

echo "Making the ENV variables accessible to scripts"

export CV_HOME_DIR=$CV_HOME_DIR
export CV_OS=$CV_OS
export CV_HOME_DIR=$CV_HOME_DIR
export CV_VIDEO_DIR=$CV_VIDEO_DIR
export CV_JSON_DIR=$CV_JSON_DIR
export CV_DB_DIR=$CV_DB_DIR
export CV_VSLAM_MAP_DIR=$CV_VSLAM_MAP_DIR

export CV_KEYFRAME_IMG_NAME_DP
export CV_KEYFRAME_IMG_DIR
export CV_KEYFRAME_IMG_EXTENSION
export CV_COORDS_TO_METRES

# 1. Convert Raw files to Equirectangular
export CV_STITCH_INSV_FILES
export CV_STITCH_INSV_FILES_DIR
export CV_STITCH_RESOLUTION

# 2. Map video with VSLAM
export CV_VSLAM_MAP_VIDEOS
export CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES
export CV_VSLAM_MAP_HEADLESS

export CV_VSLAM_MAP_NAME

# 3. Edit Loop closures (if any missed) (Recommend skipping unless later steps can't resolve issue)
export CV_EDIT_VSLAM_MAP
export CV_EDIT_VSLAM_OUTPUT_MAP_NAME

# 3. Convert VSLAM map to CV db
export CV_EXPORT_DB
export CV_EXPORT_DB_NAME

# 4. Precalculate Images' laplacian sharpness 
export CV_PRECALCULATE_IMAGE_SHARPNESS
export CV_PRECALCULATE_IMAGE_SHARPNESS_JSON_PATH

# 5. Prune CV DB
export CV_GRAPH_PRUNE
export CV_PRUNE_USE_PRECALCULATED_IMAGE_SHARPNESS
export CV_PRUNE_TARGET_CLOSENESS
export CV_PRUNE_ALWAYS_MERGE_CLOSENESS
export CV_PRUNE_OUTDOORS_ALWAYS_MERGE_CLOSENESS
export CV_PRUNE_OUTDOORS_TARGET_CLOSENESS
export CV_PRUNE_OUTDOORS_Y_DIST_THRESHOLD
export CV_PRUNE_Y_DIST_THRESHOLD
export CV_PRUNE_OUTDOORS_LOCATION_NAME
export CV_PRUNE_TABLE_PREFIX
export CV_PRUNE_USE_SQLITE;
export CV_PRUNE_DB_NAME

# 6. Copy images used in CV DB to new directory
export CV_EXTRACT_USED_IMAGES
export CV_EXTRACT_BATCH_SIZE
export CV_EXTRACT_USED_IMAGES_DIR

# 7. View and edit CV DB
export CV_EDIT_DB_VISUALLY
export CV_EDIT_DB_NAME
export CV_EDIT_DB_TABLE_PREFIX

# 8. Run CampusVirtual viewer
export CV_START_SERVER

export CV_SERVER_USE_TABLE_PREFIX
export CV_SERVER_TABLE_PREFIX
export CV_SERVER_DB_NAME
export CV_SERVER_SEND_TEST_IMAGE
export CV_SERVER_FLOORPLAN_IMG_DIR
export CV_SERVER_NEIGHBOURS_INCLUDES_PROXIMITY
export CV_SERVER_ENABLE_AUTHORING_PAGE 
export CV_SERVER_DONT_OVERWRITE_MAP_POINTS


export PATH="$CV_HOME_DIR/bin/scripts":$PATH
export PATH="$CV_HOME_DIR":$PATH