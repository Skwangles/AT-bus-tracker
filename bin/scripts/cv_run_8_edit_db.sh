#!/bin/bash
echo "EDITING CV DB"

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

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"
[[ -z "$1" && ( -z "$CV_DB_DIR" || -z "$CV_EDIT_DB_NAME" ) ]] && error_exit "Database path is not provided"
[[ -z "$2" && -z "$CV_EDIT_DB_TABLE_PREFIX" ]] && error_exit "Table prefix is not provided - If you want an 'empty' Table prefix use 'None' for this script"

DB_PATH=${1:-$CV_DB_DIR$CV_EDIT_DB_NAME}
TABLE_PREFIX=${2:-$CV_EDIT_DB_TABLE_PREFIX} 

echo "Arg 1 - DB Path:" $DB_PATH
echo "Arg 2 - Table prefix:" $TABLE_PREFIX

ORIGINAL_DIR=$(pwd)
cd "$CV_HOME_DIR"/Apps/SQLiteViewer || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/SQLiteViewer"

echo "Setting up Python environment"
python3 -m venv ./env
source ./env/bin/activate

echo "Installing necessary libraries for SQLiteViewer"
pip install -r ./requirements.txt

python3 ./view.py "$DB_PATH" "$TABLE_PREFIX"
check_command "Editing DB"
cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"
