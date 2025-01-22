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
# add JSON directory of phone to end if you want to use the JSON files - Args: <Camera's SD card path> <Video output location> <optional - CampusVirtual app JSON export path> <optional - Output JSON> -- Note: JSON dir only serves to copy associated JSON files, you could just copy them yourself
# ./ProcessFiles.out /Abs/Path/To/RawINSV /Abs/Path/To/Video /Abs/Path/To/RawJSON /Abs/Path/To/JSONOutput

# Process the videos - Arg: <isHeadless> <Root CampusVirtual Dir> --videos <Comma-separated videos> --in <optional - map to build off> --out <output sqlite3 db file name> --video_dir <Path to videos> --map_dir <path to Sqlite3 dbs - concatenated with --out value> --json_dir <path to JSON files> --picture-dir <outputted panorama images> 
./runCampusVirtual false ./ --videos video1.mp4,video2.mp4 --out map.db --video_dir /Abs/Path/To/Video/ --map_dir /Abs/Path/To/Maps/ --json_dir /Abs/Path/To/JSON/ --picture-dir /Abs/Path/To/pictures

# View the 3D SLAM map - Optional step - TODO: Add manual corrections and loop closures
# ./runCampusVirtual false ./ --videos . --in map.db --out map-edited.db --video_dir . --map_dir /Abs/Path/To/Maps/ --json_dir . --view_static

# Export to SQLite - Only <isHeadless> <Root dir>  --in <map name> and --map_dir <dir of map files> need actual values, the others can be 'fillers'
./runCampusVirtual false ./ --videos . --in map.db --out . --video_dir /Abs/Path/To/Video/ --map_dir /Abs/Path/To/Maps/ --json_dir /Abs/Path/To/JSON/ --convertToSQLite

# Python Environment
python3 -m venv Apps/SQLiteViewer/env
source Apps/SQLiteViewer/env/bin/activate

./Apps/SQLiteViewer/LIBS.sh
python3 Apps/SQLiteViewer/view.py '/path/to/db.db' refined_

pip3 install pillow
python3 Apps/SharpnessCalculator/sharpness.py /abs/img/dir /abs/output/file.json

# Prune the graph to viewing
cd ./Apps/GraphPruner
npm run start -- --img_dir='/path/to/pictures' --preproc_sharpness_json='/path/to/sharpness.json' --table_prefix='refined_'
cd ..

# Extract only the images we need
cd ./Apps/ImageSplitter
npm run start -- --input_dir=/path/in/ --output_dir=/path/out/
cd ..

# Start the front-end (please make sure the campusvirtual-backend/consts.ts)
cd campusvirtual-backend
npm run build
npm run start


