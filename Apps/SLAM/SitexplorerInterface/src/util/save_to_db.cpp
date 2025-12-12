#include "save_to_db.hpp"
#include "elevator.hpp"
#include <spdlog/spdlog.h>
#include <iostream>

void user_defined_labels_to_sqlite(sqlite3* db, const std::string& map_db_path) {
    // Create tables if they don't exist
    create_tables_if_not_exist(db);

    // New containers for elevator processing
    std::unordered_map<std::string, ElevatorShaft> elevator_shafts;
    
    // Get all user defined points
    std::vector<timestamp_annotation> user_defined_points;
    load_timestamp_groups(db, user_defined_points);
    
    for (const timestamp_annotation& user_defined_point : user_defined_points) {
        // Check if this is an elevator label
        std::string shaft_id, description;
        if (parse_elevator_label(user_defined_point.group, shaft_id, description)) {
            // Get the original point's coordinates
            sqlite3_stmt* coord_stmt = nullptr;
            const char* coord_sql = "SELECT x_trans, y_trans, z_trans FROM nodes WHERE keyframe_id = ?";
            
            if (sqlite3_prepare_v2(db, coord_sql, -1, &coord_stmt, nullptr) != SQLITE_OK) {
                spdlog::error("Failed to prepare coordinate query: {}", sqlite3_errmsg(db));
                continue;
            }
            
            sqlite3_bind_int(coord_stmt, 1, user_defined_point.keyframe_id);
            
            if (sqlite3_step(coord_stmt) != SQLITE_ROW) {
                spdlog::error("Failed to get coordinates for keyframe {}: {}", 
                    user_defined_point.keyframe_id, sqlite3_errmsg(db));
                sqlite3_finalize(coord_stmt);
                continue;
            }
            
            double x_trans = sqlite3_column_double(coord_stmt, 0);
            double y_trans = sqlite3_column_double(coord_stmt, 1);
            double z_trans = sqlite3_column_double(coord_stmt, 2);
            
            sqlite3_finalize(coord_stmt);

            // Create elevator point
            ElevatorPoint elevator_point{
                user_defined_point.keyframe_id,  // original_keyframe_id
                -1,                              // elevator_point_id (to be set)
                shaft_id,
                x_trans,
                y_trans * 1.05,                  // 5% higher
                z_trans,
                description
            };

            // Add to appropriate shaft
            elevator_shafts[shaft_id].shaft_id = shaft_id;
            elevator_shafts[shaft_id].points.push_back(elevator_point);

            // Update original point's label to anchor
            // update_original_point_label(db, user_defined_point.keyframe_id);
        }
    }

    // Process elevator points and create edges
    for (auto& [shaft_id, shaft] : elevator_shafts) {
        // Create all elevator points for this shaft
        for (auto& point : shaft.points) {
            if (!create_elevator_point(db, point)) {
                spdlog::error("Failed to create elevator point for shaft {}", shaft_id);
                continue;
            }
            
            // Create pathfind edge between elevator point and original point
            if (!create_pathfind_edge(db, point.elevator_point_id, point.keyframe_id)) {
                spdlog::error("Failed to create pathfind edge for elevator point {}", point.elevator_point_id);
                continue;
            }
        }

        // Create shaft entries for all points in this shaft
        if (!create_elevator_shafts(db, shaft.points)) {
            spdlog::error("Failed to create elevator shafts for shaft {}", shaft_id);
            continue;
        }
    }
} 