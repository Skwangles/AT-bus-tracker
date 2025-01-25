#!/bin/bash

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

echo "Starting the front-end"
cd "$CV_HOME_DIR"/Apps/campusvirtual-backend
cp "$CV_HOME_DIR"/.env .
npm run build
npm run start
