# Makefile for compiling map merging into a binary located in ../bin/linux

# Compiler and flags
CXX = g++
CXXFLAGS := $(CXXFLAGS)

# Directories
SRC_DIR = .
BUILD_DIR = ../../bin/linux
SRC = $(SRC_DIR)/merge.cpp
OUT = $(BUILD_DIR)/cv_merge_maps
INSTALL_DIR = /usr/local/bin

# Targets
all: $(OUT)

# Compile the source file into the output binary
$(OUT): $(SRC)
	@mkdir -p $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -o $(OUT) $(SRC) -O2 -lboost_system -lboost_program_options -lboost_filesystem -I /usr/include/eigen3 -lsqlite3 -lfmt

install: $(OUT)
	@echo "Installing runSitexplorer to $(INSTALL_DIR)"
	install -m 755 $(OUT) $(INSTALL_DIR)

# Clean up build files
clean:
	rm -f $(OUT)

uninstall:
	@echo "Uninstalling cv_merge_maps from $(INSTALL_DIR)"
	rm -f $(INSTALL_DIR)/cv_merge_maps

# Print the location of the binary
print:
	@echo "Binary will be located at: $(OUT)"
