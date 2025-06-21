# Makefile for compiling runSitexplorer.cc into a binary located in ../bin/linux

# Compiler and flags
CXX = g++
CXXFLAGS := $(CXXFLAGS)

# Directories
SRC_DIR = .
BUILD_DIR = ../bin/linux
SRC = $(SRC_DIR)/runSitexplorer.cc
OUT = $(BUILD_DIR)/runSitexplorer
INSTALL_DIR = /usr/local/bin

# Targets
all: $(OUT)

# Compile the source file into the output binary
$(OUT): $(SRC)
	@mkdir -p $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -o $(OUT) $(SRC) -O2 -lboost_system -lboost_program_options -lboost_filesystem

install: $(OUT)
	@echo "Installing runSitexplorer to $(INSTALL_DIR)"
	install -m 755 $(OUT) $(INSTALL_DIR)

# Clean up build files
clean:
	rm -f $(OUT)

uninstall:
	@echo "Uninstalling runSitexplorer from $(INSTALL_DIR)"
	rm -f $(INSTALL_DIR)/runSitexplorer

# Print the location of the binary
print:
	@echo "Binary will be located at: $(OUT)"
