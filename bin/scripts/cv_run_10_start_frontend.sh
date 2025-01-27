#!/bin/bash

function error_exit {
    echo "Error: $1"
    exit 1
}

echo "RUNNING FRONT END"

# Check if the required inputs are provided as arguments or environment variables
if [[ -z "$CV_HOME_DIR" ]]; then
    error_exit "CV_HOME_DIR is not set"
fi

echo "Starting the front-end"
cd "$CV_HOME_DIR"/Apps/campusvirtual-backend || error_exit "Failed to change directory"
cp "$CV_HOME_DIR"/.env . || error_exit "Failed to copy .env file"
npm run build || error_exit "Failed to build the project"
npm run start || error_exit "Failed to start the project"
