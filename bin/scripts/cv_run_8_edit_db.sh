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

DB_PATH=${1:-$CV_DB_DIR$CV_EDIT_DB_NAME}

echo "Arg 1 - DB Path:" $DB_PATH

ORIGINAL_DIR=$(pwd)
cd "$CV_HOME_DIR"/Apps/SQLiteViewer || error_exit "Failed to change directory to $CV_HOME_DIR/Apps/SQLiteViewer"

echo "Setting up Python environment"

if [[ ! -d "$CV_HOME_DIR/py-venv" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$CV_HOME_DIR/py-venv"
fi
echo "Activating virtual environment..."
source "$CV_HOME_DIR/py-venv/bin/activate"

echo "Installing necessary libraries for SQLiteViewer"
pip install -r ./requirements.txt

python ./view.py "$DB_PATH"
check_command "Editing DB"
cd "$ORIGINAL_DIR" || error_exit "Failed to change back to original directory"
