#!/bin/bash

CURRENT_DIR=$(pwd)

cd $CV_HOME_DIR

if [ ! -f .env ]; then
  echo "You must rename .env.example to .env, and customise it."
  echo "Aborting"
  exit 
fi

cp .env Apps/campusvirtual-backend/
cp .env Apps/GraphPruner/
cp .env Apps/ImageSplitter/