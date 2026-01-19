#pragma once

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>
#include <string>

#include <sqlite3.h>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;


class timestamp_annotation {
public:
    std::string group;
    double timestamp;
    double ms;

    timestamp_annotation(std::string group, double timestamp, double ms)
        : group(group), timestamp(timestamp),  ms(ms) {}
};
    
class video_timestamp {
public:
    std::string name;
    double start_timestamp;
    double stop_timestamp;

    video_timestamp(std::string name, double start_timestamp, double stop_timestamp)
        : name(name), start_timestamp(start_timestamp), stop_timestamp(stop_timestamp) {}
};
    
std::vector<video_timestamp> load_video_timestamps_sqlite3(sqlite3* db);

std::vector<timestamp_annotation> load_user_defined_point_timestamps(sqlite3* db, std::vector<timestamp_annotation>& results);

std::vector<timestamp_annotation> load_timestamp_groups(sqlite3* db, std::vector<timestamp_annotation>& results);

int save_user_defined_point_timestamps_to_sqlite3(sqlite3 *db, std::string group, double timestamp, double ms);

int save_timestamp_groups_to_sqlite3(sqlite3 *db, std::string group, double timestamp, double ms);

int save_video_to_sqlite3(sqlite3 *db, std::string video_name, double start_timestamp, double end_timestamp);

void save_timestamps_to_sqlite3(sqlite3* db, std::vector<timestamp_annotation> timestamp_group_list, std::vector<timestamp_annotation> user_defined_points_list);

bool convert_user_defined_labels_to_other_nodes(sqlite3* db);