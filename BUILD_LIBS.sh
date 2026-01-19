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

# Exit on error
set -e

echo "Building Libraries"

# Function to check command success
check_command() {
  if [ $? -ne 0 ]; then
    echo "Error occurred during: $1"
    exit 1
  fi
}

if [ -n "$CV_LIBS_CONFIGURED" ]; then 
    echo "Libs already built, skipping."
    exit
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" # https://saturncloud.io/blog/how-to-get-the-directory-where-a-bash-script-is-located/#:~:text=The%20first%20method%20to%20get,directory%20name%20from%20the%20path.

if [ -z "$CV_HOME_DIR" ]; then
  source $SCRIPT_DIR/SOURCE_SETUP.sh
fi

LIBS_DIR="$CV_HOME_DIR"/libs
NON_MODIFIABLE_LIBS_DIR="$CV_HOME_DIR"/libs/tmp
mkdir -p $LIBS_DIR
mkdir -p $NON_MODIFIABLE_LIBS_DIR 

echo "Initialising submodules"

git submodule update --recursive

# Stella libs - https://stella-cv.readthedocs.io/en/latest/installation.html
sudo apt update -y
sudo apt upgrade -y --no-install-recommends
# basic dependencies
sudo apt install -y build-essential pkg-config cmake git wget curl unzip
# g2o dependencies
sudo apt install -y libsuitesparse-dev libdw-dev libdwarf-dev
# OpenCV dependencies
sudo apt install -y libgtk-3-dev ffmpeg libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libtbb-dev
# Additional OpenCV build dependencies
sudo apt install -y libjpeg-dev libpng-dev libtiff-dev libopenexr-dev libwebp-dev libv4l-dev libxvidcore-dev libx264-dev
# eigen dependencies
sudo apt install -y gfortran
# backward-cpp dependencies (optional)
sudo apt install -y binutils-dev
# other dependencies
sudo apt install -y libyaml-cpp-dev libgflags-dev sqlite3 libsqlite3-dev

sudo apt install -y libeigen3-dev libspdlog-dev libsuitesparse-dev qtdeclarative5-dev qt5-qmake libqglviewer-dev-qt5

# (if you plan on using IridescenceViewer)
# Iridescence dependencies
sudo apt install -y libglm-dev libglfw3-dev libpng-dev libjpeg-dev libeigen3-dev libboost-filesystem-dev libboost-program-options-dev
# Install boost-process (version-specific package name on newer Ubuntu)
sudo apt install -y libboost-process1.88-dev || sudo apt install -y libboost-process-dev || sudo apt install -y libboost-all-dev
# (Or build eigen from source if still not found)

# (if you plan on using SocketViewer)
# Protobuf dependencies
sudo apt install -y autogen autoconf libtool
# Node.js
# sudo apt install -y nodejs
# sudo apt install -y npm






sudo ldconfig # update lookup library paths - IMPORTANT if 'libxx.so' not found.

echo ""
echo "Compiling Supporting Programs"

export CXXFLAGS="-std=c++17"
echo "CXXFLAGS=" $CXXFLAGS


# Install Custom FBoW used
cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d FBoW ] ; then
    git clone https://github.com/stella-cv/FBoW.git
fi
cd FBoW
mkdir build -p && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    ..
make -j4 && sudo make install


# Eigen3 - https://gitlab.com/libeigen/eigen
sudo apt install libeigen3-dev

# Build OpenCV from source to ensure compatibility with system FFmpeg libraries
# This ensures OpenCV is built against the correct FFmpeg versions (61/59/8)
cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d opencv ] ; then
    git clone https://github.com/opencv/opencv.git
fi
if [ ! -d opencv_contrib ] ; then
    git clone https://github.com/opencv/opencv_contrib.git
fi
cd opencv
git checkout 4.13.0  # Use the same version as apt package for compatibility
cd ../opencv_contrib
git checkout 4.13.0
cd ../opencv
# Clean build directory if it exists to force fresh build
if [ -d build ]; then
    rm -rf build
fi
mkdir build -p && cd build
cmake -D CMAKE_BUILD_TYPE=Release \
      -D CMAKE_INSTALL_PREFIX=/usr/local \
      -D OPENCV_EXTRA_MODULES_PATH=$NON_MODIFIABLE_LIBS_DIR/opencv_contrib/modules \
      -D WITH_FFMPEG=ON \
      -D BUILD_EXAMPLES=OFF \
      -D BUILD_DOCS=OFF \
      -D BUILD_TESTS=OFF \
      -D BUILD_PERF_TESTS=OFF \
      -D BUILD_opencv_python2=OFF \
      -D BUILD_opencv_python3=OFF \
      -D WITH_GTK=ON \
      -D WITH_QT=OFF \
      -D WITH_OPENGL=ON \
      -D WITH_TBB=ON \
      -D ENABLE_CXX11=ON \
      -D CMAKE_CXX_STANDARD=17 \
      ..
make -j$(nproc)
check_command "Building OpenCV from source"
sudo make install
sudo ldconfig

# Install g2o
cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d g2o ] ; then
    git clone https://github.com/RainerKuemmerle/g2o.git
fi
cd g2o
git checkout 20230223_git

mkdir build -p && cd build
cmake -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_SHARED_LIBS=ON \
    -DBUILD_UNITTESTS=OFF \
    -DG2O_USE_CHOLMOD=OFF \
    -DG2O_USE_LOGGING=OFF \
    -DG2O_USE_CSPARSE=ON \
    -DG2O_USE_OPENGL=OFF \
    -DG2O_USE_OPENMP=OFF \
    -DG2O_BUILD_APPS=OFF \
    -DG2O_BUILD_EXAMPLES=OFF \
    -DG2O_BUILD_LINKED_APPS=OFF \
    ..
make -j4 && sudo make install

# Install backward-cpp - 
cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d backward-cpp ] ; then
    git clone https://github.com/bombela/backward-cpp.git
fi

cd backward-cpp
git checkout 5ffb2c879ebdbea3bdb8477c671e32b1c984beaa
mkdir build -p && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    ..
make -j4 && sudo make install


################# VIEWERS #####################
# Install Iridescence
cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d iridescence ] ; then
    git clone https://github.com/koide3/iridescence.git
fi
cd iridescence
git checkout 085322e0c949f75b67d24d361784e85ad7f197ab
git submodule update --init --recursive
# Fix CMakeLists.txt to include boost-process (required for info_window.cpp)
if [ -f CMakeLists.txt ]; then
    sed -i 's/find_package(Boost REQUIRED filesystem program_options)/find_package(Boost REQUIRED filesystem program_options process)/' CMakeLists.txt
fi
# Clean build directory if it exists to force CMake reconfiguration
if [ -d build ]; then
    rm -rf build
fi
mkdir build -p && cd build
cmake \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    ..
make -j4 && sudo make install


sudo apt install -y libprotobuf-dev protobuf-compiler

cd $NON_MODIFIABLE_LIBS_DIR
if [ ! -d socket.io-client-cpp ] ; then
    git clone https://github.com/shinsumicco/socket.io-client-cpp.git
fi
cd socket.io-client-cpp
git submodule init
git submodule update
# Fix rapidjson compatibility issue with GCC 15 (assignment to const member)
# The assignment operator tries to assign to const members, which GCC 15 rejects
if [ -f lib/rapidjson/include/rapidjson/document.h ]; then
    python3 << 'EOF'
import re
file_path = "lib/rapidjson/include/rapidjson/document.h"
with open(file_path, 'r') as f:
    content = f.read()
# Replace the problematic assignment operator with a deleted one
pattern = r'(\s+)GenericStringRef& operator=\(const GenericStringRef& rhs\) \{ s = rhs\.s; length = rhs\.length; \}'
replacement = r'\1GenericStringRef& operator=(const GenericStringRef& rhs) = delete; // Deleted: cannot assign to const members'
content = re.sub(pattern, replacement, content)
with open(file_path, 'w') as f:
    f.write(content)
EOF
fi
mkdir build -p && cd build
cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    -DBUILD_UNIT_TESTS=OFF \
    ..
make -j4
check_command "Building Socket.IO Client"
sudo make install

############### BUILD STELLA VSLAM ###############

echo "--"
echo "Compiling Sitexplorer Libs"

# Install stella_vslam core library
cd $LIBS_DIR
if [ ! -d stella_vslam ] ; then
    git clone --recursive https://github.com/SiteXplore/SLAM.git
fi
cd stella_vslam
git checkout sitexplorer
mkdir build -p && cd build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo ..
make -j4
check_command "Building Stella VSLAM"
sudo make install
# MAYBE TRY PATCH THE STELLA WITH MY MODIFICATIONS

# When building with support for IridescenceViewer - allows you to manually trigger loop closures
cd $LIBS_DIR
if [ ! -d iridescence_viewer ] ; then
    git clone --recursive https://github.com/SiteXplore/SLAM-Iridescence-Viewer.git
fi
cd iridescence_viewer
git checkout sitexplorer
mkdir -p build
cd build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo -DCMAKE_CXX_STANDARD=17 -DCMAKE_CXX_STANDARD_REQUIRED=ON ..
make -j
check_command "Building Iridescence Viewer"
sudo make install


# When building with support for SocketViewer
cd $LIBS_DIR
if [ ! -d sitexplorer_socket_publisher ] ; then
    git clone --recursive https://github.com/SiteXplore/SLAM-Socket-Publisher.git # Custom socket_publisher which doesn't send current frame, only the map - forked from https://github.com/stella-cv/socket_publisher.git
fi
mkdir -p sitexplorer_socket_publisher/build
cd sitexplorer_socket_publisher/build
cmake -DCMAKE_BUILD_TYPE=RelWithDebInfo ..
make -j
check_command "Building Sitexplorer Socket Publisher"
sudo make install


sudo ldconfig


CV_LIBS_CONFIGURED=1
export CV_LIBS_CONFIGURED