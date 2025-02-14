#!/bin/bash
echo "MAPPING VIDEOS WITH VSLAM"

# Function to print error message and exit
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

# Check if the required environment variables are set
[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$CV_VSLAM_MAP_DIR" ]] && error_exit "CV_VSLAM_MAP_DIR is not set"
[[ -z "$CV_JSON_DIR" ]] && error_exit "CV_JSON_DIR is not set"
[[ -z "$CV_KEYFRAME_IMG_DIR" ]] && error_exit "CV_KEYFRAME_IMG_DIR is not set"
[[ -z "$CV_VSLAM_MAP_HEADLESS" ]] && error_exit "CV_VSLAM_MAP_HEADLESS is not set"
[[ -z "$CV_VSLAM_EPOCH_START" ]] && error_exit "CV_VSLAM_EPOCH_START is not set"
[[ -z "$CV_VIDEO_DIR" ]] && error_exit "CV_VIDEO_DIR is not set"

# Check if the required inputs are provided either as arguments or environment variables
VIDEOS=${1:-$CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES}
MAP=${2:-$CV_VSLAM_MAP_NAME}

[[ -z "$VIDEOS" ]] && error_exit "No videos specified. Provide as argument or set CV_VSLAM_MAP_VIDEOS_COMMA_SEPARATED_NAMES"
[[ -z "$MAP" ]] && error_exit "No map name specified. Provide as argument or set CV_VSLAM_MAP_NAME"

echo "Videos Processed:" $VIDEOS
echo "Output Map:" $MAP
echo "(Optional) Input Map - (Extend previously made map):" $3

IN_MAP_OPTION=""
[[ -n "$3" ]] && IN_MAP_OPTION="--in \'$3\'"
EPOCH_OPTION=""
[[ -n "$CV_VSLAM_EPOCH_START" ]] && EPOCH_OPTION="--ts $CV_VSLAM_EPOCH_START"

runCampusVirtual $CV_VSLAM_MAP_HEADLESS \'$CV_HOME_DIR\' \'$VIDEOS\' --out \'$MAP\' $IN_MAP_OPTION --video_dir \'$CV_VIDEO_DIR\' --map_dir \'$CV_VSLAM_MAP_DIR\' --json_dir \'$CV_JSON_DIR\' --picture_dir \'$CV_KEYFRAME_IMG_DIR\' $EPOCH_OPTION
check_command "Mapping videos with VSLAM"
