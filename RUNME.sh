#!/bin/bash

# Depends on the Stella VSLAM and CampusVirtualInterfaces already being built 
# ./BUILD_LIBS.sh # This builds dependencies

echo "Building CampusVirtual Files"
./BUILD_CAMPUS_VIRTUAL.sh

# Build the CampusVirtual control program and .insv video stitcher
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options
g++ Apps/CampusVirtual-FileProcessing/ProcessFiles.cpp -o ProcessFiles.out

echo "Running ProcessFiles"

# Stitch the videso into equirectangular, you can do this with Insta360's Insta360 Studio - You must install the Media SDK yourself as it is provided with the camera (https://www.insta360.com/sdk/home)
# add JSON directory of phone to end if you want to use the JSON files - Args: <Camera's SD card path> <Video output location> <CampusVirtual app JSON export path> <Output JSON> -- Note: JSON dir only serves to copy associated JSON files, you could just copy them yourself
# ./ProcessFiles.out /Abs/Path/To/RawINSV /Abs/Path/To/Video /Abs/Path/To/RawJSON /Abs/Path/To/JSONOutput

# Process the videos - Arg: <isHeadless> <Root CampusVirtual Dir> --videos <Comma-separated videos> --out <output sqlite3 db file name> --media_dir <Path to videos> --map_dir <path to Sqlite3 dbs - concatenated with --out value> --json_dir <path to JSON files> --picture-dir <outputted panorama images> 
./runCampusVirtual false ./ --videos video1.mp4,video2.mp4 --out map.db --video_dir /Abs/Path/To/Video/ --map_dir /Abs/Path/To/Maps/ --json_dir /Abs/Path/To/JSON/ --picture-dir /Abs/Path/To/pictures

# View the 3D SLAM map - Args: <isHeadless> <Root CampusVirtual Dir> -- For all but map_dir, and --in you just need to give 'filler' args- Optional step - TODO: Add manual corrections and loop closures
# ./runCampusVirtual false ./ --videos . --in map.db --out map-edited.db --media_dir . --map_dir /Abs/Path/To/Maps/ --json_dir . --convertToGraph

# Export to postgres - Only <isHeadless> <Root dir>  --in <map name> and --map_dir <dir of map files> need actual values, the others can be 'fillers'
./runCampusVirtual false ./ --videos . --in map.db --out . --video_dir /Abs/Path/To/Video/ --map_dir /Abs/Path/To/Maps/ --json_dir /Abs/Path/To/JSON/ --convertToPg

# Prune the graph to viewing
cd ./Apps/GraphPruner
npm run start

# Setup and Run Front-end
# Build Authoring page - This page should be disabled in campusvirtual-backend/consts.ts once ready for public serving
# Visit localhost:3001/authoring (campusvirtual-viewer's url with /authoring path) to align points to minimap
cd Apps/authoring && npm run build && cd ../..


# Create a TMux session with both the PgSocketViewer and the CampusVirtual-Viewer running
sudo apt update
sudo apt install tmux 
./START_SERVERS.sh

