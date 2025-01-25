#!/bin/bash
echo "MAPPING VIDEOS WITH VSLAM"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES" || -z "$CV_VSLAM_MAP_NAME" || -z "$CV_VSLAM_MAP_DIR" || -z "$CV_JSON_DIR" || -z "$CV_KEYFRAME_IMG_DIR" || -z "$CV_VSLAM_MAP_HEADLESS" || -z "$CV_VIDEO_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

VIDEOS=${1:-$CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES}
MAP=${2:-$CV_VSLAM_MAP_NAME}
echo "Videos Processed:" $VIDEOS
echo "Output Map:" $MAP
echo "(Optional) Input Map - (Extend previously made map):" $3

if [ -z "$3" ]; then
    
    runCampusVirtual $CV_VSLAM_MAP_HEADLESS $CV_HOME_DIR --videos $VIDEOS --out $MAP --video_dir $CV_VIDEO_DIR --map_dir $CV_VSLAM_MAP_DIR --json_dir $CV_JSON_DIR --picture_dir $CV_KEYFRAME_IMG_DIR
else
    echo "Building off " $3
    runCampusVirtual $CV_VSLAM_MAP_HEADLESS $CV_HOME_DIR --videos $VIDEOS --out $MAP --in $3 --video_dir $CV_VIDEO_DIR --map_dir $CV_VSLAM_MAP_DIR --json_dir $CV_JSON_DIR --picture_dir $CV_KEYFRAME_IMG_DIR
fi