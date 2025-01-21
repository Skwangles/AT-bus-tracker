
g++ Apps/CampusVirtual-FileProcessing/ProcessFiles.cpp -o ProcessFiles.out
g++ ./ENTRYPOINT/runCampusVirtual.cc -o runCampusVirtual -lboost_program_options

echo "Running ProcessFiles"

# Stitch the videso into equirectangular, you can do this with Insta360's Insta360 Studio - You must install the Media SDK yourself as it is provided with the camera (https://www.insta360.com/sdk/home)
# add JSON directory of phone to end if you want to use the JSON files - Args: <Camera's SD card path> <Video output location> <CampusVirtual app JSON export path> <Output JSON> -- Note: JSON dir only serves to copy associated JSON files, you could just copy them yourself
# ./ProcessFiles.out /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Video


# ./runCampusVirtual false ./ --videos VID_20241213_154018_00_054.mp4 --out zone1.db --video_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Video/ --map_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/pictures/
# ./runCampusVirtual false ./ --videos VID_20241213_154153_00_055.mp4 --out zone2.db --video_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Video/ --map_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/ --json_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/JSON/ --picture-dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/pictures/


./runCampusVirtual false ./ --in zone1.db --out output1.db --map_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/ --convertToSQLite
./runCampusVirtual false ./ --in zone2.db --out output2.db --map_dir /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/ --convertToSQLite