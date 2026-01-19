#include "save_to_db.hpp"
#include "elevator.hpp"
#include <spdlog/spdlog.h>
#include <iostream>


    
std::vector<video_timestamp> load_video_timestamps_sqlite3(sqlite3* db) {
    std::vector<video_timestamp> results;
    sqlite3_stmt* stmt;

    const char* sql = "SELECT name, start_ts, end_ts FROM video_timestamps";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, 0) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double start_ts = sqlite3_column_double(stmt, 1);
            double end_ts = sqlite3_column_double(stmt, 2);

            results.emplace_back(video_timestamp(name, start_ts, end_ts));
        }
        sqlite3_finalize(stmt);
    } else {
        std::cerr << "Failed to execute query: " << sqlite3_errmsg(db) << std::endl;
    }

    return results;
}

std::vector<timestamp_annotation> load_user_defined_point_timestamps(sqlite3* db, std::vector<timestamp_annotation>& results) {
    sqlite3_stmt* stmt;

    const char* sql = "SELECT name, timestamp, ms FROM special_point_timestamps";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, 0) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string annotation = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double ts = sqlite3_column_double(stmt, 1);
            double ms = sqlite3_column_double(stmt, 2);

            results.emplace_back(timestamp_annotation(annotation, ts, ms));
        }
        sqlite3_finalize(stmt);
    } else {
        std::cerr << "Failed to execute query: " << sqlite3_errmsg(db) << std::endl;
    }

    return results;
}

std::vector<timestamp_annotation> load_timestamp_groups(sqlite3* db, std::vector<timestamp_annotation>& results) {
    sqlite3_stmt* stmt;

    const char* sql = "SELECT name, timestamp, ms FROM timestamp_groups";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, 0) == SQLITE_OK) {
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            std::string group = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            double ts = sqlite3_column_double(stmt, 1);
            double ms = sqlite3_column_double(stmt, 2);

            results.emplace_back(timestamp_annotation(group, ts, ms));
        }
        sqlite3_finalize(stmt);
    } else {
        std::cerr << "Failed to execute query: " << sqlite3_errmsg(db) << std::endl;
    }

    return results;
}

int save_user_defined_point_timestamps_to_sqlite3(sqlite3 *db, std::string group, double timestamp, double ms){
    
    std::vector<std::pair<std::string, std::string>> columns{
        {"name", "BLOB"},
        {"timestamp", "REAL"},
        {"ms", "NUMERIC"}
        };

    int ret = 0;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "CREATE TABLE IF NOT EXISTS special_point_timestamps(id INTEGER PRIMARY KEY AUTOINCREMENT";
        for (const auto& column : columns) {
            stmt_str += ", " + column.first + " " + column.second;
        }
        stmt_str += ");";
        ret = sqlite3_exec(db, stmt_str.c_str(), nullptr, nullptr, nullptr);
    }

    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (create_table): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_exec(db, "BEGIN;", nullptr, nullptr, nullptr);
    }

    sqlite3_stmt* stmt = nullptr;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "INSERT INTO special_point_timestamps(";
        bool first = true;
        for (const auto& column : columns) {
            if (first) {
                stmt_str += column.first;
                first = false;
            } else {
                stmt_str += ", " + column.first;
            }
        }
        stmt_str += ") VALUES(";
        first = true;
        for (size_t i = 0; i < columns.size(); ++i) {
            if (first) {
                stmt_str += "?";
                first = false;
            } else {
                stmt_str += ", ?";
            }
        }
        stmt_str += ")";
        ret = sqlite3_prepare_v2(db, stmt_str.c_str(), -1, &stmt, nullptr);
    }
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (prepare): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_blob(stmt, 1, group.c_str(), group.size(), SQLITE_TRANSIENT);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 2, timestamp);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 3, ms);
    }
    
    

    if (ret == SQLITE_OK) {
            ret = sqlite3_step(stmt);
    }
    if (ret != SQLITE_DONE) {
        spdlog::error("SQLite step failed: {}", sqlite3_errmsg(db));
        return false;
    }
    sqlite3_finalize(stmt);
    ret = sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (commit): {}", sqlite3_errmsg(db));
        return false;
    }

    return 0;
}



int save_timestamp_groups_to_sqlite3(sqlite3 *db, std::string group, double timestamp, double ms){
    
    std::vector<std::pair<std::string, std::string>> columns{
        {"name", "BLOB"},
        {"timestamp", "REAL"},
        {"ms", "NUMERIC"}
        };

    int ret = 0;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "CREATE TABLE IF NOT EXISTS timestamp_groups(id INTEGER PRIMARY KEY AUTOINCREMENT";
        for (const auto& column : columns) {
            stmt_str += ", " + column.first + " " + column.second;
        }
        stmt_str += ");";
        ret = sqlite3_exec(db, stmt_str.c_str(), nullptr, nullptr, nullptr);
    }

    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (create_table): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_exec(db, "BEGIN;", nullptr, nullptr, nullptr);
    }

    sqlite3_stmt* stmt = nullptr;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "INSERT INTO timestamp_groups(";
        bool first = true;
        for (const auto& column : columns) {
            if (first) {
                stmt_str += column.first;
                first = false;
            } else {
                stmt_str += ", " + column.first;
            }
        }
        stmt_str += ") VALUES(";
        first = true;
        for (size_t i = 0; i < columns.size(); ++i) {
            if (first) {
                stmt_str += "?";
                first = false;
            } else {
                stmt_str += ", ?";
            }
        }
        stmt_str += ")";
        ret = sqlite3_prepare_v2(db, stmt_str.c_str(), -1, &stmt, nullptr);
    }
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (prepare): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_blob(stmt, 1, group.c_str(), group.size(), SQLITE_TRANSIENT);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 2, timestamp);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 3, ms);
    }
    
    

    if (ret == SQLITE_OK) {
            ret = sqlite3_step(stmt);
    }
    if (ret != SQLITE_DONE) {
        spdlog::error("SQLite step failed: {}", sqlite3_errmsg(db));
        return false;
    }
    sqlite3_finalize(stmt);
    ret = sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (commit): {}", sqlite3_errmsg(db));
        return false;
    }

    return 0;
}



int save_video_to_sqlite3(sqlite3 *db, std::string video_name, double start_timestamp, double end_timestamp){
    
    std::vector<std::pair<std::string, std::string>> columns{
        {"name", "BLOB"},
        {"start_ts", "REAL"},
        {"end_ts", "REAL"}};

    int ret = 0;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "CREATE TABLE IF NOT EXISTS video_timestamps(id INTEGER PRIMARY KEY AUTOINCREMENT";
        for (const auto& column : columns) {
            stmt_str += ", " + column.first + " " + column.second;
        }
        stmt_str += ");";
        ret = sqlite3_exec(db, stmt_str.c_str(), nullptr, nullptr, nullptr);
    }

    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (create_table): {}", sqlite3_errmsg(db));
        return false;
    }

    if (ret == SQLITE_OK) {
        ret = sqlite3_exec(db, "BEGIN;", nullptr, nullptr, nullptr);
    }

    sqlite3_stmt* stmt = nullptr;
    if (ret == SQLITE_OK) {
        std::string stmt_str = "INSERT INTO video_timestamps(";
        bool first = true;
        for (const auto& column : columns) {
            if (first) {
                stmt_str += column.first;
                first = false;
            } else {
                stmt_str += ", " + column.first;
            }
        }
        stmt_str += ") VALUES(";
        first = true;
        for (size_t i = 0; i < columns.size(); ++i) {
            if (first) {
                stmt_str += "?";
                first = false;
            } else {
                stmt_str += ", ?";
            }
        }
        stmt_str += ")";
        ret = sqlite3_prepare_v2(db, stmt_str.c_str(), -1, &stmt, nullptr);
    }
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (prepare): {}", sqlite3_errmsg(db));
        return false;
    }

    
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_blob(stmt, 1, video_name.c_str(), video_name.size(), SQLITE_TRANSIENT);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 2, start_timestamp);
    }
    if (ret == SQLITE_OK) {
        ret = sqlite3_bind_double(stmt, 3, end_timestamp);
    }

    if (ret == SQLITE_OK) {
            ret = sqlite3_step(stmt);
    }
    if (ret != SQLITE_DONE) {
        spdlog::error("SQLite step failed: {}", sqlite3_errmsg(db));
        return false;
    }
    sqlite3_finalize(stmt);
    ret = sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("SQLite error (commit): {}", sqlite3_errmsg(db));
        return false;
    }

    return 0;
}


void save_timestamps_to_sqlite3(sqlite3* db, std::vector<timestamp_annotation> timestamp_group_list, std::vector<timestamp_annotation> user_defined_points_list){

    for (auto& timestamp_group : timestamp_group_list) {
        save_timestamp_groups_to_sqlite3(db, timestamp_group.group , timestamp_group.timestamp, timestamp_group.ms);
        std::cout << "Group: " << timestamp_group.group << " Timestamp: " << timestamp_group.timestamp <<  " Ms: " << timestamp_group.ms << std::endl;
    }
    
    for (auto& user_defined_point : user_defined_points_list) {
        save_user_defined_point_timestamps_to_sqlite3(db, user_defined_point.group , user_defined_point.timestamp, user_defined_point.ms);
        std::cout << "User Defined Point: " << user_defined_point.group << " Timestamp: " << user_defined_point.timestamp <<  " Ms: " << user_defined_point.ms << std::endl;
    }

}


bool convert_user_defined_labels_to_other_nodes(sqlite3* db) {
    // Get all user defined labels
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT keyframe_id, label FROM user_defined_labels";
    
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare user defined labels query: {}", sqlite3_errmsg(db));
        return false;
    }

    std::unordered_map<std::string, std::vector<OtherNode>> elevator_shafts;

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        int keyframe_id = sqlite3_column_int(stmt, 0);
        std::string label = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));

        // Get node coordinates
        sqlite3_stmt* coord_stmt = nullptr;
        const char* coord_sql = "SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = ?";
        
        if (sqlite3_prepare_v2(db, coord_sql, -1, &coord_stmt, nullptr) != SQLITE_OK) {
            spdlog::error("Failed to prepare coordinate query: {}", sqlite3_errmsg(db));
            continue;
        }

        sqlite3_bind_int(coord_stmt, 1, keyframe_id);
        
        if (sqlite3_step(coord_stmt) != SQLITE_ROW) {
            spdlog::error("Failed to get coordinates for keyframe {}: {}", keyframe_id, sqlite3_errmsg(db));
            sqlite3_finalize(coord_stmt);
            continue;
        }

        double x_trans = sqlite3_column_double(coord_stmt, 0);
        double y_trans = sqlite3_column_double(coord_stmt, 1);
        double z_trans = sqlite3_column_double(coord_stmt, 2);
        
        sqlite3_finalize(coord_stmt);

        // Create other node
        OtherNode node;
        node.ref_id = keyframe_id;
        node.label = label;
        node.x_trans = x_trans;
        node.y_trans = y_trans * 1.05; // 5% higher
        node.z_trans = z_trans;

        // Parse label to determine type and description
        std::string shaft_id, description;
        bool is_elevator = false;
        if (parse_elevator_label(label, shaft_id, description)) {
            node.type = OTHER_ELEVATOR_NODE;
            node.description = description;
            is_elevator = true;
        } else if (label.find("!!toilet") == 0) {
            node.type = OTHER_TOILET_NODE;  // Type 2 for toilet
            // Parse toilet label: "!!toilet, <description>"
            size_t comma_pos = label.find(",");
            if (comma_pos != std::string::npos) {
                node.description = label.substr(comma_pos + 1);
                // Trim leading whitespace
                node.description = node.description.substr(node.description.find_first_not_of(" \t"));
            } else {
                node.description = label.substr(7); // Remove "!!toilet" prefix
            }
        } else if (label.find("!!info") == 0) {
            node.type = OTHER_INFO_NODE;
            node.description = label.substr(7);
        } else {
            node.type = OTHER_NORMAL_NODE;
            node.description = label;
        }

        // Add node to database and get the ID
        int other_node_id = add_other_node(db, node);
        if (other_node_id == -1) {
            spdlog::error("Failed to add other node for keyframe {}: {}", keyframe_id, label);
            continue;
        }
        
        node.id = other_node_id;
        
        // Store elevator node in the map after we have the ID
        if (is_elevator) {
            elevator_shafts[shaft_id].push_back(node);
        }
    }

    sqlite3_finalize(stmt);

    // Create elevator shaft entries for each node
    for (const auto& [shaft_id, nodes] : elevator_shafts) {
        for (const auto& node : nodes) {
            spdlog::info("Adding elevator shaft entry for node {} with shaft_id {}", node.id, shaft_id);
            if (!add_elevator_shaft(db, node.id, shaft_id)) {
                spdlog::error("Failed to add elevator shaft entry for node {} with shaft_id {}", 
                    node.id, shaft_id);
            }
        }
    }

    return true;
} 