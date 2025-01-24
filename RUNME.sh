#!/bin/bash

if [ ! -f .env ]; then
  echo ".env not found - You MUST rename .env.example to .env and customise it!"
  echo "Aborting so you don't accidentally use the wrong config!"
  exit
fi

source .env
sudo ./bin/scripts/cv_run_add_to_path.sh
sudo ./bin/scripts/cv_run_copy_env_file.sh

cd $CV_HOME_DIR

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built 
./BUILD_LIBS.sh # This builds dependencies

echo "Building CampusVirtual Files"
./BUILD_CAMPUS_VIRTUAL.sh

if [ "$CV_STITCH_INSV_FILES" == true ]; then
  ./bin/scripts/cv_run_process_files.sh
fi

# Process the videos - Arg: <isHeadless> <Root CampusVirtual Dir> --videos <Comma-separated videos> --in <optional - map to build off> --out <output sqlite3 db file name> --video_dir <Path to videos> --map_dir <path to Sqlite3 dbs - concatenated with --out value> --json_dir <path to JSON files> --picture-dir <outputted panorama images> 
if [ "$CV_VSLAM_MAP_VIDEOS" == true ]; then
  ./bin/scripts/cv_run_map.sh # (to customise, args: <csv video names> <output map name.db> <(optional) input map name.db>)
fi

# View the 3D SLAM map - Optional step - TODO: Add manual corrections and loop closures
if [ "$CV_EDIT_VSLAM_MAP" == true ]; then
  ./bin/scripts/cv_run_view_vslam_map.sh
fi

if [ "$CV_EXPORT_DB" == true ]; then
  ./bin/scripts/cv_run_export_sqlite.sh
fi

if [ "$CV_PRECALCULATE_IMAGE_SHARPNESS" == true ]; then
  ./bin/scripts/cv_run_sharpness_calculate.sh
fi

if [ "$CV_EDIT_DB_VISUALLY" == true ]; then
  ./bin/scripts/cv_run_view_db.sh
fi

# Prune the graph to viewing
if [ "$CV_GRAPH_PRUNE" == true ]; then
  ./bin/scripts/cv_run_prune_graph.sh
fi

# Extract only the images we need
if [ "$CV_EXTRACT_USED_IMAGES" == true ]; then
  ./bin/scripts/cv_run_extract_images.sh
fi

# Start the front-end (please make sure the campusvirtual-backend/consts.ts)
if [ "$CV_START_SERVER" == true ]; then
  ./bin/scripts/cv_run_start_frontend.sh
fi

