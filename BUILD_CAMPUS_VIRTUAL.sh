########## CAMPUS VIRTUAL SPECIFIC CODE ##########
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

if [ -z "$CV_HOME_DIR" ]; then
  source $SCRIPT_DIR/SOURCE_SETUP.sh
fi

# Exit on error
set -e

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}


if [ $(id -u) -eq 0 ]; then
    echo "Do not run with SUDO, otherwise you won't be able to compile necessary libraries as accessible to the user"
    echo "If only root user exists, remove the first IF from ./BUILD_LIBS.sh"
    echo "The program will prompt for root access when necessary"
    read -p "Are you sure you want to continue? (y/n): " choice
    case "$choice" in 
      y|Y ) echo "Continuing...";;
      * ) exit;;
    esac
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

echo "Building Face Blurring"
cd "$CV_HOME_DIR/Apps/blur360-images"
mkdir -p build && cd build
cmake ..
make
sudo make install


echo "Building VSLAM CampusVirtual interface"
mkdir -p "$CV_HOME_DIR"/Apps/SLAM/CampusVirtualInterface/build
cd "$CV_HOME_DIR"/Apps/SLAM/CampusVirtualInterface/build 
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DUSE_STACK_TRACE_LOGGER=ON ..
make -j4
check_command "Building VSLAM CampusVirtual interface"
sudo make install

echo "Building MapMerger"
cd "$CV_HOME_DIR"/Apps/MapMerge
make
check_command "Building MapMerger"
sudo make install

echo "Building CLI interfaces"
cd "$CV_HOME_DIR"/ENTRYPOINT
make
check_command "Building CLI interfaces"
sudo make install


cd "$CV_HOME_DIR"/Apps/CampusVirtual-FileProcessing
make
check_command "Building CampusVirtual-FileProcessing"
sudo make install
