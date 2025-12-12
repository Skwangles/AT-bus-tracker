#include "elevator.hpp"
#include <spdlog/spdlog.h>
#include <regex>
#include <iostream>

bool create_tables_if_not_exist(sqlite3* db) {
    int ret = 0;

    // Create other_nodes table
    if (!create_other_nodes_table(db)) {
        spdlog::error("Failed to create other_nodes table");
        return false;
    }

    // Create elevator_shafts table
    if (!create_elevator_shafts_table(db)) {
        spdlog::error("Failed to create elevator_shafts table");
        return false;
    }

    return true;
}

bool parse_elevator_label(const std::string& label, std::string& shaft_id, std::string& description) {
    // Expected format: "!!elevator, <shaft_id>, <description>"
    if (label.find("!!elevator") != 0) {
        return false;
    }
    
    std::vector<std::string> parts;
    size_t pos = 0;
    std::string delimiter = ",";
    std::string label_copy = label;
    
    while ((pos = label_copy.find(delimiter)) != std::string::npos) {
        parts.push_back(label_copy.substr(0, pos));
        label_copy.erase(0, pos + delimiter.length());
    }
    parts.push_back(label_copy); // Add the last part
    
    if (parts.size() >= 3) {
        shaft_id = parts[1].substr(parts[1].find_first_not_of(" \t"));
        description = parts[2].substr(parts[2].find_first_not_of(" \t"));
        return true;
    }
    
    return false;
}


bool create_elevator_shafts(sqlite3* db, const std::vector<ElevatorPoint>& points) {
    // Store each point with its shaft_id
    for (const auto& point : points) {
        if (!add_elevator_shaft(db, point.elevator_point_id, point.shaft_id)) {
            spdlog::error("Failed to add elevator shaft entry for point {} with shaft_id {}", 
                point.elevator_point_id, point.shaft_id);
            continue;
        }
    }

    return true;
}


bool create_other_nodes_table(sqlite3* db) {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS other_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            info TEXT,
            image TEXT,
            type INTEGER NOT NULL,
            x_trans REAL NOT NULL,
            y_trans REAL NOT NULL,
            z_trans REAL NOT NULL,
            FOREIGN KEY (ref_id) REFERENCES nodes(keyframe_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_other_nodes_type ON other_nodes(type);
        CREATE INDEX IF NOT EXISTS idx_other_nodes_ref ON other_nodes(ref_id);
        CREATE UNIQUE INDEX unique_other_nodes ON other_nodes(ref_id, label, description)
    )";

    char* err_msg = nullptr;
    int ret = sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
    
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to create other_nodes table: {}", err_msg);
        sqlite3_free(err_msg);
        return false;
    }

    return true;
}

bool create_elevator_shafts_table(sqlite3* db) {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS elevator_shafts (
            other_node_id INTEGER PRIMARY KEY,
            shaft_id TEXT NOT NULL,
            FOREIGN KEY (other_node_id) REFERENCES other_nodes(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_elevator_shafts_shaft ON elevator_shafts(shaft_id);
    )";

    char* err_msg = nullptr;
    int ret = sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
    
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to create elevator_shafts table: {}", err_msg);
        sqlite3_free(err_msg);
        return false;
    }

    return true;
}

bool add_other_node(sqlite3* db, OtherNode& node) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = R"(
        INSERT INTO other_nodes
        (ref_id, label, description, type, x_trans, y_trans, z_trans)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
    )";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare other_node insert: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_int(stmt, 1, node.ref_id);
    sqlite3_bind_text(stmt, 2, node.label.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_text(stmt, 3, node.description.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 4, static_cast<int>(node.type));
    sqlite3_bind_double(stmt, 5, node.x_trans);
    sqlite3_bind_double(stmt, 6, node.y_trans);
    sqlite3_bind_double(stmt, 7, node.z_trans);

    if (sqlite3_step(stmt) != SQLITE_ROW) {
        spdlog::error("Failed to insert other_node: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        return false;
    }

    node.id = sqlite3_column_int(stmt, 0);
    sqlite3_finalize(stmt);
    return true;
}

bool add_elevator_shaft(sqlite3* db, int other_node_id, const std::string& shaft_id) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = R"(
        INSERT OR REPLACE INTO elevator_shafts 
        (other_node_id, shaft_id)
        VALUES (?, ?)
    )";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare elevator_shaft insert: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_int(stmt, 1, other_node_id);
    sqlite3_bind_text(stmt, 2, shaft_id.c_str(), -1, SQLITE_STATIC);

    if (sqlite3_step(stmt) != SQLITE_DONE) {
        spdlog::error("Failed to insert elevator_shaft: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        return false;
    }

    sqlite3_finalize(stmt);
    return true;
}

bool get_elevator_shafts_by_shaft(sqlite3* db, const std::string& shaft_id, std::vector<int>& other_node_ids) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT other_node_id FROM elevator_shafts WHERE shaft_id = ?";
    
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare elevator_shafts query: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_text(stmt, 1, shaft_id.c_str(), -1, SQLITE_STATIC);
    
    other_node_ids.clear();
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        int other_node_id = sqlite3_column_int(stmt, 0);
        other_node_ids.push_back(other_node_id);
    }

    sqlite3_finalize(stmt);
    return true;
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
        if (parse_elevator_label(label, shaft_id, description)) {
            node.type = OTHER_ELEVATOR_NODE;
            node.description = description;
            elevator_shafts[shaft_id].push_back(node);
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

        // Add node to database
        if (!add_other_node(db, node)) {
            spdlog::error("Failed to add other node for keyframe {}: {}", keyframe_id, label);
            continue;
        }
    }

    sqlite3_finalize(stmt);

    // Create elevator shaft entries for each node
    for (const auto& [shaft_id, nodes] : elevator_shafts) {
        for (const auto& node : nodes) {
            if (!add_elevator_shaft(db, node.id, shaft_id)) {
                spdlog::error("Failed to add elevator shaft entry for node {} with shaft_id {}", 
                    node.id, shaft_id);
            }
        }
    }

    return true;
} 