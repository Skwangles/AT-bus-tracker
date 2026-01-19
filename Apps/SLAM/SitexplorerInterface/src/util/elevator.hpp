#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <sqlite3.h>

// New struct to hold elevator point information
struct ElevatorPoint {
    int keyframe_id;        // Original point ID
    int elevator_point_id;  // New elevator point ID
    std::string shaft_id;   // Elevator shaft identifier
    double x_trans;
    double y_trans;
    double z_trans;
    std::string description;
};

// New struct to hold elevator shaft information
struct ElevatorShaft {
    std::string shaft_id;
    std::vector<ElevatorPoint> points;
};

// Edge types (matching existing system)
enum EdgeType {
    COVISIBILITY = -1,  // Covisibility edges (shared landmarks)
    NORMAL = 0,         // Normal navigation edges
    LOOP = 1,           // Loop closure edges
    MERGE = 2,          // Merge point edges
    CONTRACTION = 3,    // Edge contraction edges
    PATHFIND = 4        // Pathfinding edges (for elevator connections)
};

// Node types
enum NodeType {
    NORMAL_NODE = 0,    // Regular navigation node
    ELEVATOR_NODE = 1,  // Elevator point node
    ANCHOR_NODE = 2     // Original point marked as anchor
};

// Reserved label types
const std::string RESERVED_ANCHOR = "!!anchor";
const std::string RESERVED_ELEVATOR = "!!elevator";

// Node types for other_nodes table
enum OtherNodeType {
    OTHER_NORMAL_NODE = 0,    // Regular navigation node
    OTHER_ELEVATOR_NODE = 1,  // Elevator point node
    OTHER_TOILET_NODE = 2,      // Information point
    OTHER_INFO_NODE = 3       // Room point
};

// New struct to hold other node information
struct OtherNode {
    int id;             // Unique ID
    int ref_id;         // Reference to node in Nodes table
    std::string label;  // Label string
    std::string description; // Raw text description
    std::string info;   // Extra info for InfoSpots
    std::string image;  // Optional image name
    OtherNodeType type; // Node type
    double x_trans;     // X translation
    double y_trans;     // Y translation
    double z_trans;     // Z translation
};

// New struct to hold elevator edge information
struct ElevatorEdge {
    int id;             // Unique ID
    std::string shaft_id; // Shaft identifier
    int id0;            // First elevator node ID
    int id1;            // Second elevator node ID
};

bool create_tables_if_not_exist(sqlite3* db);

bool parse_elevator_label(const std::string& label, std::string& shaft_id, std::string& description);

bool create_other_nodes_table(sqlite3* db);

bool create_elevator_shafts_table(sqlite3* db);

int add_other_node(sqlite3* db, OtherNode& node);

bool add_elevator_shaft(sqlite3* db, int other_node_id, const std::string& shaft_id);

bool get_elevator_shafts_by_shaft(sqlite3* db, const std::string& shaft_id, std::vector<int>& other_node_ids);
