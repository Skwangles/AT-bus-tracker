#!/bin/bash

function error_exit {
  echo "Error: $1"
  exit 1
}

echo "COPYING ENV FILES TO SUB DIRECTORIES"
CURRENT_DIR=$(pwd)

[[ -z "$CV_HOME_DIR" ]] && error_exit "CV_HOME_DIR is not set"

cd $CV_HOME_DIR || error_exit "Failed to change directory to $CV_HOME_DIR"

if [ -z "$CV_ENV_PATH" ]; then
  echo "CV_ENV_PATH not set - setting to $CV_HOME_DIR/.env"
  export CV_ENV_PATH=$CV_HOME_DIR/.env
  echo "CV_ENV_PATH=$CV_ENV_PATH"
fi

if [ ! -f $CV_ENV_PATH ]; then
  echo ".env could not be found at $CV_ENV_PATH"
  echo "You must rename .env.example to .env, and customise it, or set CV_ENV_PATH to the correct custom path"
  echo "Aborting"
  exit 1 
fi



cp $CV_ENV_PATH Apps/authoring-backend/.env || error_exit "Failed to copy .env to Apps/authoring-backend/"
cp $CV_ENV_PATH Apps/GraphPruner/.env || error_exit "Failed to copy .env to Apps/GraphPruner/"
cp $CV_ENV_PATH Apps/map_data_init/.env || error_exit "Failed to copy .env to Apps/map_data_init/"
cp $CV_ENV_PATH Apps/ImageProcessor/.env || error_exit "Failed to copy .env to Apps/ImageProcessor/"