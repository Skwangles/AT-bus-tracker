#!/bin/bash

function error_exit {
  echo "Error: $1"
  exit 1
}

echo "COPYING ENV FILES TO SUB DIRECTORIES"
CURRENT_DIR=$(pwd)

[[ -z "$SX_HOME_DIR" ]] && error_exit "SX_HOME_DIR is not set"

cd $SX_HOME_DIR || error_exit "Failed to change directory to $SX_HOME_DIR"

if [ -z "$SX_ENV_PATH" ]; then
  echo "SX_ENV_PATH not set - setting to $SX_HOME_DIR/.env"
  export SX_ENV_PATH=$SX_HOME_DIR/.env
  echo "SX_ENV_PATH=$SX_ENV_PATH"
fi

if [ ! -f $SX_ENV_PATH ]; then
  echo ".env could not be found at $SX_ENV_PATH"
  echo "You must rename .env.example to .env, and customise it, or set SX_ENV_PATH to the correct custom path"
  echo "Aborting"
  exit 1 
fi



cp $SX_ENV_PATH Apps/authoring-backend/.env || error_exit "Failed to copy .env to Apps/authoring-backend/"
cp $SX_ENV_PATH Apps/GraphProcessor/.env || error_exit "Failed to copy .env to Apps/GraphProcessor/"
cp $SX_ENV_PATH Apps/map_data_init/.env || error_exit "Failed to copy .env to Apps/map_data_init/"
cp $SX_ENV_PATH Apps/ImageProcessor/.env || error_exit "Failed to copy .env to Apps/ImageProcessor/"