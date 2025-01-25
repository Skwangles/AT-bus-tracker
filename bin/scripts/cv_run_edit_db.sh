#!/bin/bash
echo "EDITING CV DB"

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" || -z "$CV_EDIT_DB_TABLE_PREFIX" || -z "$CV_DB_DIR" || -z "$CV_EDIT_DB_NAME" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

TABLE_PREFIX=${1:-$CV_EDIT_DB_TABLE_PREFIX} 
DB_PATH=${2:-$CV_DB_DIR$CV_EDIT_DB_NAME}



echo "Table prefix:" $TABLE_PREFIX
echo "DB Path:" $DB_PATH

ORIGINAL_DIR=${pwd}
cd "$CV_HOME_DIR"/Apps/SQLiteViewer

echo "Setting up Python environment"
python3 -m venv ./env
source ./env/bin/activate

echo "Installing necessary libraries for SQLiteViewer"
pip install -r ./requirements.txt

python3 ./view.py $DB_PATH $TABLE_PREFIX
cd $ORIGINAL_DIR
