function error_exit {
  echo "Error: $1"
  exit 1
}

echo "MERGING MAPS"

# Check if the required environment variables are set
[[ -z "$CV_DB_DIR" ]] && error_exit "CV_DB_DIR is not set"

# Check if the required arguments or corresponding environment variables are set
[[ -z "$1" && -z "$CV_MERGE_1_NAME" ]] && error_exit "Argument 1 or CV_MERGE_1_NAME is not set"
[[ -z "$2" && -z "$CV_MERGE_2_NAME" ]] && error_exit "Argument 2 or CV_MERGE_2_NAME is not set"
[[ -z "$3" && -z "$CV_MERGE_OUTPUT_NAME" ]] && error_exit "Argument 3 or CV_MERGE_OUTPUT_NAME is not set"
[[ -z "$4" && -z "$CV_MERGE_2_ZONE" ]] && error_exit "Argument 4 or CV_MERGE_2_ZONE is not set"
[[ -z "$5" && -z "$CV_MERGE_1_OVERWRITE_ZONE_NAME" ]] && error_exit "Argument 5 or CV_MERGE_1_OVERWRITE_ZONE_NAME is not set"

IN_1=${1:-$CV_DB_DIR/$CV_MERGE_1_NAME}
IN_2=${2:-$CV_DB_DIR/$CV_MERGE_2_NAME}
OUT=${3:-$CV_DB_DIR/$CV_MERGE_OUTPUT_NAME}
ZONE2=${4:-$CV_MERGE_2_ZONE}
ZONE1=${5:-$CV_MERGE_1_OVERWRITE_ZONE_NAME}

echo "Arg 1 - Name 1 (*.db):" $IN_1
echo "Arg 2 - Name 2 (*.db):" $IN_2
echo "Arg 3 - Output Name (*.db): " $OUT
echo "Arg 4 - Map 2 zone name: " $ZONE2
echo "(Optional) Arg 5 - Map 1 zone name (will overwrite all name 1's zone entries in the output):" $ZONE1

cv_merge_maps $IN_1 $IN_2 $OUT \
  $([ "$CV_MERGE_OVERWRITE_EXISTING_OUTPUT" == "true" ] && echo "--overwrite") \
  $([ -n "$ZONE1" ] && echo "--zone1 $ZONE1") \
  --zone2 $ZONE2
