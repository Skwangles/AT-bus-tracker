########## CAMPUS VIRTUAL SPECIFIC CODE ##########
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

if [ -z "$CV_HOME_DIR" ]; then
  source $SCRIPT_DIR/bin/scripts/cv_run_add_to_path.sh
fi


if [ $(id -u) -eq 0 ]; then
  echo "Do not run with sudo"
  echo "if you still want to run as the root user, comment out this 'IF' in BUILD_CAMPUS_VIRTUAL.sh"
  exit
fi


if [ -z "$CXXFLAGS" ] ; then
    export CXXFLAGS="-std=c++17"
    echo "Set CXXFLAGS=$CXXFLAGS"
else
    # Needs to be appended
    export CXXFLAGS="-std=c++17 $CXXFLAGS"
    echo "Appended -std=c++17 to CXXFLAGS"
fi

# Install custom socket_viewer which acts like Google Street View - forked from https://github.com/stella-cv/socket_viewer.git
# cd PgSocketViewer && sudo npm install && cd ..
# Make sure to run this in a separate terminal before running the CampusVirtualInterface with `node app.js`

cd "$CV_HOME_DIR"/Apps
pwd

# Installs MediaSDKTest tool for stitching videos
# sudo dpkg -i CampusVirtual-FileProcessing/libMediaSDK-dev_2.0-3_amd64_ubuntu18.04.deb
# Note: This SDK is only provided with purchase of a camera: https://www.insta360.com/sdk/home -- You must install it yourself

sudo ldconfig # update lookup library paths again - IMPORTANT if 'libxx.so' not found, note: libxx.so.7 <- 7 is the version number of the package

# IF G2O gives a QT error - sudo apt install -y qtcreator qtbase5-dev qt5-qmake cmake



echo "Building VSLAM CampusVirtual interface"
mkdir -p "$CV_HOME_DIR"/Apps/SLAM/CampusVirtualInterface/build
cd "$CV_HOME_DIR"/Apps/SLAM/CampusVirtualInterface/build 
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DUSE_STACK_TRACE_LOGGER=ON ..
make -j4 && sudo make install

echo "Building CLI interfaces"
cd "$CV_HOME_DIR"/ENTRYPOINT
make && sudo make install

cd "$CV_HOME_DIR"/Apps/CampusVirtual-FileProcessing
make && sudo make install
