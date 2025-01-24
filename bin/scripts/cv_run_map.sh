#!/bin/bash

echo "Running CampusVirtual with video processing"
echo "Videos Processed:" ${1:-$CV_COMMA_SEPARATED_VSLAM_INPUT_VIDEOS}
echo "Output Map:" ${2:-$CV_VSLAM_MAP_NAME}
echo "(Optional) Input Map - (Extend previously made map):" $3

if [ -z "$3" ]; then
    "$CV_HOME_DIR"/runCampusVirtual $CV_VSLAM_MAP_HEADLESS $CV_HOME_DIR --videos ${1:-$CV_COMMA_SEPARATED_VSLAM_INPUT_VIDEOS} --out ${2:-$CV_VSLAM_MAP_NAME} --video_dir $CV_VIDEO_DIR --map_dir $CV_MAP_DIR --json_dir $CV_JSON_DIR --picture-dir $CV_PICTURE_DIR
else
    "$CV_HOME_DIR"/runCampusVirtual $CV_VSLAM_MAP_HEADLESS $CV_HOME_DIR --videos ${1:-$CV_COMMA_SEPARATED_VSLAM_INPUT_VIDEOS} --out ${2:-$CV_VSLAM_MAP_NAME} --in $3 --video_dir $CV_VIDEO_DIR --map_dir $CV_MAP_DIR --json_dir $CV_JSON_DIR --picture-dir $CV_PICTURE_DIR
fi