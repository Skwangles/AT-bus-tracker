#!/bin/bash
echo "COPYING ENV FILES TO SUB DIRECTORIES"
CURRENT_DIR=$(pwd)

# Check if the required inputs are empty
if [[ -z "$CV_HOME_DIR" ]]; then
    echo "Error: One or more inputs are empty"
    exit 1
fi

cd $CV_HOME_DIR

if [ ! -f .env ]; then
  echo "You must rename .env.example to .env, and customise it."
  echo "Aborting"
  exit 1 
fi

cp .env Apps/campusvirtual-backend/
cp .env Apps/GraphPruner/
cp .env Apps/ImageSplitter/