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

echo "MERGING MAPS"

# Check if the required environment variables are set
[[ -z "$SX_DB_DIR" ]] && error_exit "SX_DB_DIR is not set"

# Check if the required arguments or corresponding environment variables are set
[[ -z "$1" && -z "$SX_MERGE_1_NAME" ]] && error_exit "Argument 1 or SX_MERGE_1_NAME is not set"
[[ -z "$2" && -z "$SX_MERGE_2_NAME" ]] && error_exit "Argument 2 or SX_MERGE_2_NAME is not set"
[[ -z "$3" && -z "$SX_MERGE_OUTPUT_NAME" ]] && error_exit "Argument 3 or SX_MERGE_OUTPUT_NAME is not set"
[[ -z "$4" && -z "$SX_MERGE_2_ZONE" ]] && error_exit "Argument 4 or SX_MERGE_2_ZONE is not set"
[[ -z "$5" && -z "$SX_MERGE_1_OVERWRITE_ZONE_NAME" ]] && error_exit "Argument 5 or SX_MERGE_1_OVERWRITE_ZONE_NAME is not set"

IN_1=${1:-$SX_DB_DIR/$SX_MERGE_1_NAME}
IN_2=${2:-$SX_DB_DIR/$SX_MERGE_2_NAME}
OUT=${3:-$SX_DB_DIR/$SX_MERGE_OUTPUT_NAME}
ZONE2=${4:-$SX_MERGE_2_ZONE}
ZONE1=${5:-$SX_MERGE_1_OVERWRITE_ZONE_NAME}

echo "Arg 1 - Name 1 (*.db):" $IN_1
echo "Arg 2 - Name 2 (*.db):" $IN_2
echo "Arg 3 - Output Name (*.db): " $OUT
echo "Arg 4 - Map 2 zone name: " $ZONE2
echo "(Optional) Arg 5 - Map 1 zone name (will overwrite all name 1's zone entries in the output):" $ZONE1

sx_merge_maps $IN_1 $IN_2 $OUT \
  $([ "$SX_MERGE_OVERWRITE_EXISTING_OUTPUT" == "true" ] && echo "--overwrite") \
  $([ -n "$ZONE1" ] && echo "--zone1 $ZONE1") \
  --zone2 $ZONE2
check_command "Merging maps"