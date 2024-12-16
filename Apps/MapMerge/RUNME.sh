g++ merge.cpp -o merge -lboost_system -lboost_filesystem -lboost_program_options -I /usr/include/eigen3 -lsqlite3 -lfmt



# merge -1 <DB1> -2 <DB2> -o merged.db --map_dir <PATH>
./merge /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/output1.db /media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/output2.db test.db --overwrite true



# source viewer/view/bin/activate
# python view.py <DB PATH>
python viewer/view.py test.db