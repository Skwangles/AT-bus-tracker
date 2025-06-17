#include "elevator.hpp"
#include <spdlog/spdlog.h>
#include <regex>
#include <iostream>

bool create_tables_if_not_exist(sqlite3* db) {
    int ret = 0;
    
    // Add node_type column to nodes table if it doesn't exist
    const char* add_node_type_sql = 
        "ALTER TABLE nodes ADD COLUMN node_type INTEGER DEFAULT 0;";
    ret = sqlite3_exec(db, add_node_type_sql, nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK && ret != SQLITE_DONE) {
        spdlog::error("Failed to add node_type column: {}", sqlite3_errmsg(db));
        return false;
    }

    // Add edge_type column to edges table if it doesn't exist
    const char* add_edge_type_sql = 
        "ALTER TABLE edges ADD COLUMN edge_type INTEGER DEFAULT 0;";
    ret = sqlite3_exec(db, add_edge_type_sql, nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK && ret != SQLITE_DONE) {
        spdlog::error("Failed to add edge_type column: {}", sqlite3_errmsg(db));
        return false;
    }

    // Create indexes if they don't exist
    const char* create_node_index_sql = 
        "CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);";
    ret = sqlite3_exec(db, create_node_index_sql, nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to create node type index: {}", sqlite3_errmsg(db));
        return false;
    }

    const char* create_edge_index_sql = 
        "CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);";
    ret = sqlite3_exec(db, create_edge_index_sql, nullptr, nullptr, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to create edge type index: {}", sqlite3_errmsg(db));
        return false;
    }

    // Create other_nodes table
    if (!create_other_nodes_table(db)) {
        spdlog::error("Failed to create other_nodes table");
        return false;
    }

    // Create elevator_edges table
    if (!create_elevator_edges_table(db)) {
        spdlog::error("Failed to create elevator_edges table");
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

bool create_elevator_point(sqlite3* db, ElevatorPoint& point) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "INSERT INTO nodes (x_trans, y_trans, z_trans, node_type) VALUES (?, ?, ?, 1) RETURNING keyframe_id;";
    
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare elevator point insert: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_double(stmt, 1, point.x_trans);
    sqlite3_bind_double(stmt, 2, point.y_trans);
    sqlite3_bind_double(stmt, 3, point.z_trans);

    if (sqlite3_step(stmt) != SQLITE_ROW) {
        spdlog::error("Failed to insert elevator point: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        return false;
    }

    point.elevator_point_id = sqlite3_column_int(stmt, 0);
    sqlite3_finalize(stmt);
    return true;
}

bool create_elevator_edges(sqlite3* db, const std::vector<ElevatorPoint>& points) {
    if (points.size() < 2) {
        return true; // No edges needed for single point
    }

    // Create edges between all pairs of points in the shaft
    for (size_t i = 0; i < points.size(); ++i) {
        for (size_t j = i + 1; j < points.size(); ++j) {
            // Create ElevatorEdge struct
            ElevatorEdge edge;
            edge.shaft_id = points[i].shaft_id;
            edge.id0 = points[i].elevator_point_id;
            edge.id1 = points[j].elevator_point_id;

            if (!add_elevator_edge(db, edge)) {
                spdlog::error("Failed to add elevator connection between points {} and {}", 
                    points[i].elevator_point_id, points[j].elevator_point_id);
                continue;
            }
        }
    }

    return true;
}

bool update_original_point_label(sqlite3* db, int keyframe_id) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = "UPDATE nodes SET node_type = 2 WHERE keyframe_id = ?;";
    
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare original point update: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_int(stmt, 1, keyframe_id);

    if (sqlite3_step(stmt) != SQLITE_DONE) {
        spdlog::error("Failed to update original point: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        return false;
    }

    sqlite3_finalize(stmt);
    return true;
}

bool create_other_nodes_table(sqlite3* db) {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS other_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            type INTEGER NOT NULL,
            x_trans REAL NOT NULL,
            y_trans REAL NOT NULL,
            z_trans REAL NOT NULL,
            FOREIGN KEY (ref_id) REFERENCES nodes(keyframe_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_other_nodes_type ON other_nodes(type);
        CREATE INDEX IF NOT EXISTS idx_other_nodes_ref ON other_nodes(ref_id);
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

bool create_elevator_edges_table(sqlite3* db) {
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS elevator_edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shaft_id TEXT NOT NULL,
            id0 INTEGER NOT NULL,
            id1 INTEGER NOT NULL,
            FOREIGN KEY (id0) REFERENCES other_nodes(id) ON DELETE CASCADE,
            FOREIGN KEY (id1) REFERENCES other_nodes(id) ON DELETE CASCADE,
            UNIQUE(id0, id1)
        );
        CREATE INDEX IF NOT EXISTS idx_elevator_edges_shaft ON elevator_edges(shaft_id);
        CREATE INDEX IF NOT EXISTS idx_elevator_edges_nodes ON elevator_edges(id0, id1);
    )";

    char* err_msg = nullptr;
    int ret = sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
    
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to create elevator_edges table: {}", err_msg);
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

bool add_elevator_edge(sqlite3* db, const ElevatorEdge& edge) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = R"(
        INSERT OR REPLACE INTO elevator_edges 
        (shaft_id, id0, id1)
        VALUES (?, ?, ?)
    )";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare elevator_edge insert: {}", sqlite3_errmsg(db));
        return false;
    }

    sqlite3_bind_text(stmt, 1, edge.shaft_id.c_str(), -1, SQLITE_STATIC);
    sqlite3_bind_int(stmt, 2, edge.id0);
    sqlite3_bind_int(stmt, 3, edge.id1);

    if (sqlite3_step(stmt) != SQLITE_DONE) {
        spdlog::error("Failed to insert elevator_edge: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        return false;
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
            node.type = OTHER_INFO_NODE;  // Type 2 for toilet
            // Parse toilet label: "!!toilet, <description>"
            size_t comma_pos = label.find(",");
            if (comma_pos != std::string::npos) {
                node.description = label.substr(comma_pos + 1);
                // Trim leading whitespace
                node.description = node.description.substr(node.description.find_first_not_of(" \t"));
            } else {
                node.description = label.substr(8); // Remove "!!toilet" prefix
            }
        } else if (label.find("info:") == 0) {
            node.type = OTHER_INFO_NODE;
            node.description = label.substr(5);
        } else if (label.find("room:") == 0) {
            node.type = OTHER_ROOM_NODE;
            node.description = label.substr(5);
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

    // Create elevator edges for each shaft
    for (const auto& [shaft_id, nodes] : elevator_shafts) {
        for (size_t i = 0; i < nodes.size(); ++i) {
            for (size_t j = i + 1; j < nodes.size(); ++j) {
                ElevatorEdge edge;
                edge.shaft_id = shaft_id;
                edge.id0 = nodes[i].id;
                edge.id1 = nodes[j].id;

                if (!add_elevator_edge(db, edge)) {
                    spdlog::error("Failed to add elevator edge between nodes {} and {}", 
                        nodes[i].id, nodes[j].id);
                }
            }
        }
    }

    return true;
} 