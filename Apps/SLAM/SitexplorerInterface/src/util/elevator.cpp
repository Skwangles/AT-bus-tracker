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

int add_other_node(sqlite3* db, OtherNode& node) {
    sqlite3_stmt* stmt = nullptr;
    const char* sql = R"(
        INSERT INTO other_nodes
        (ref_id, label, description, type, x_trans, y_trans, z_trans)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
    )";

    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        spdlog::error("Failed to prepare other_node insert: {}", sqlite3_errmsg(db));
        return -1;
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
        return -1;
    }

    int id = sqlite3_column_int(stmt, 0);
    spdlog::info("Added other node with id {}", id);
    sqlite3_finalize(stmt);
    return id;
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
