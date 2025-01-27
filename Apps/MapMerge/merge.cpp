#include <iostream>
#include <string>
#include <vector>
#include <unordered_map>
#include <Eigen/Dense>
#include <Eigen/Geometry>

#include <boost/program_options.hpp>
#include <boost/filesystem.hpp>
#include <sqlite3.h>
#include <spdlog/spdlog.h>
#include <unordered_map>

namespace po = boost::program_options;
namespace fs = boost::filesystem;

struct NodeInfo {
    int keyframe_id;
    double ts;
    Eigen::Matrix4d pose;
    double x_trans;
    double y_trans;
    double z_trans;
    std::string label;
};

class MapMerger {
private:
    sqlite3* first_db;
    sqlite3* second_db;
    sqlite3* out_db;

    // Extract nodes with labels starting with '$$'
    std::vector<NodeInfo> extractLabeledNodes(sqlite3* db, const std::string& prefix = "$$") {
        std::vector<NodeInfo> labeled_nodes;
        sqlite3_stmt* stmt;
        std::string query = "SELECT n.keyframe_id, ts, pose, x_trans, y_trans, z_trans, s.label "
                            "FROM nodes n JOIN special_labels s ON n.keyframe_id = s.keyframe_id WHERE s.label LIKE '" + prefix + "%'";
        
        if (sqlite3_prepare_v2(db, query.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            spdlog::error("Failed to prepare statement: {}", sqlite3_errmsg(db));
            return labeled_nodes;
        }

        while (sqlite3_step(stmt) == SQLITE_ROW) {
            NodeInfo node;
            node.keyframe_id = sqlite3_column_int(stmt, 0);
            node.ts = sqlite3_column_double(stmt, 1);
            
            // Deserialize pose BLOB (assuming it's stored as a serialized matrix)
            const void* blob = sqlite3_column_blob(stmt, 2);
            int blob_size = sqlite3_column_bytes(stmt, 2);
            std::cout << "Pose Size: " << blob_size << std::endl; 
            double pose[16];
            memcpy(&pose, blob, 16 * sizeof(double));
            node.pose = Eigen::Map<Eigen::MatrixXd>(pose, 4, 4);
            // You might need a custom deserialization method depending on your exact serialization
            
            node.x_trans = sqlite3_column_double(stmt, 3);
            node.y_trans = sqlite3_column_double(stmt, 4);
            node.z_trans = sqlite3_column_double(stmt, 5);
            
            const unsigned char* label = sqlite3_column_text(stmt, 6);
            node.label = label ? reinterpret_cast<const char*>(label) : "";

            std::cout << "Label found: " << label << std::endl;
            labeled_nodes.push_back(node);
        }

        sqlite3_finalize(stmt);
        return labeled_nodes;
    }

    // Find matching labeled nodes between two databases
    std::vector<std::pair<NodeInfo, NodeInfo>> findMatchingLabeledNodes(
        const std::vector<NodeInfo>& first_nodes, 
        const std::vector<NodeInfo>& second_nodes
    ) {
        std::vector<std::pair<NodeInfo, NodeInfo>> matching_nodes;
        
        for (const auto& first_node : first_nodes) {
            for (const auto& second_node : second_nodes) {
                if (first_node.label == second_node.label) {
                    matching_nodes.emplace_back(first_node, second_node);
                }
            }
        }

        return matching_nodes;
    }

    void Mat4dToVec(Eigen::Matrix4d pose, std::vector<double>& vec){
            for (int i = 0; i < 16; i++) {
                int ir = i / 4;
                int il = i % 4;
                vec.push_back(pose(ir, il));
            }
    }

    /**
     * @brief Compute Procrustes Analysis on the merge points - uses the translations of the World-to-Camera conversion i.e. trans_wc()
     * Only computer the 2D rotation of XZ (Y is the vertical axis) to avoid roll/pitch on points (Points should already be roll/pitch aligned from SLAM)
     * @param matching_nodes - Vector of points that should be the 'same point in different maps/coordinate systems'
     * @return Eigen::Affine3d - Rotation and translations matrix
     */
    Eigen::Affine3d calculateGlobalTransformation_wc(
        const std::vector<std::pair<NodeInfo, NodeInfo>>& matching_nodes
    ) {
        size_t num_points = matching_nodes.size();
        if (num_points < 2) {
            throw std::invalid_argument("At least two matching nodes are required.");
        }

        
        Eigen::MatrixXd merge_point_cloud1(3, num_points);
        Eigen::MatrixXd merge_point_cloud2(3, num_points);

        for (size_t i = 0; i < num_points; ++i) {
            merge_point_cloud1.col(i) << matching_nodes[i].first.x_trans,matching_nodes[i].first.y_trans,  matching_nodes[i].first.z_trans;
            merge_point_cloud2.col(i) << matching_nodes[i].second.x_trans,matching_nodes[i].second.y_trans,  matching_nodes[i].second.z_trans;
        }

        // 1. Compute centroids of both point sets.
        Eigen::Vector3d centroid_cloud1 = merge_point_cloud1.rowwise().mean();
        Eigen::Vector3d centroid_cloud2 = merge_point_cloud2.rowwise().mean();

        // 2. Center the points around the centroids.
        Eigen::MatrixXd centered_cloud1 = merge_point_cloud1.colwise() - centroid_cloud1;
        Eigen::MatrixXd centered_cloud2 = merge_point_cloud2.colwise() - centroid_cloud2;



        // 3. To avoid pan/roll rotations, only Compute the 2D covariance matrix in the XZ plane.
        Eigen::Matrix2d covariance = Eigen::Matrix2d::Zero();
        for (size_t i = 0; i < num_points; i++) {

            auto vec1_x = centered_cloud1(0, i);
            auto vec1_z = centered_cloud1(2, i);
            auto vec2_x = centered_cloud2(0, i);
            auto vec2_z = centered_cloud2(2, i);
            
            Eigen::Vector2d vec1(vec1_x, vec1_z), vec2(vec2_x, vec2_z);
            covariance += vec1 * vec2.transpose();
        }

        // 4. Singular Value Decomposition & Procrustes analysis to find optimal rotation
        Eigen::JacobiSVD<Eigen::Matrix2d> svd(covariance, Eigen::ComputeFullU | Eigen::ComputeFullV);
        Eigen::Matrix2d rotation_2d = svd.matrixU() * svd.matrixV().transpose();

        // 5. Ensure the rotation matrix is a proper rotation (det = 1).
        if (rotation_2d.determinant() < 0) {
            rotation_2d.col(1) *= -1;
        }

        // 6. Copy the 2d rotation (YAW calc) to higher dimension
        Eigen::Matrix3d rotation = Eigen::Matrix3d::Identity();
        rotation(0, 0) = rotation_2d(0, 0);
        rotation(0, 2) = rotation_2d(0, 1);
        rotation(2, 0) = rotation_2d(1, 0);
        rotation(2, 2) = rotation_2d(1, 1);

        // 7. Compute the translation.
        Eigen::Vector3d translation = centroid_cloud1 - rotation * centroid_cloud2;

        // 8. Construct the affine transformation (rotation + translation).
        Eigen::Affine3d transformation = Eigen::Affine3d::Identity();
        transformation.linear() = rotation;
        transformation.translation() = translation;

        std::cout << "Computed Global Transformation: Rot: \n" << rotation << " \n Trans: \n" << translation << std::endl;
        return transformation;
    }

    void mergeDatabase(const std::string& out_path, std::string zone1_name, std::string zone2_name) {

        // Open databases
        int ret = sqlite3_open(out_path.c_str(), &out_db);
        if (ret != SQLITE_OK) {
            spdlog::error("Cannot open output database: {}", sqlite3_errmsg(out_db));
            return;
        }

        if (zone1_name.size() > 0) {
            // out_db is a copy of first_db, so overwrite first_db's rows
            spdlog::info("Setting ALL First DB's rows' zone to: {}", zone1_name);
            set_zones(out_db, zone1_name, false);
        }
        else {
            spdlog::info("No First DB zone 1 set, skipping overwrite...");
        }

        spdlog::info("Extracting merge points (special_labels denoted by '$$...')");
        auto first_labeled_nodes = extractLabeledNodes(first_db);
        auto second_labeled_nodes = extractLabeledNodes(second_db);

        
        auto merge_keyframes = findMatchingLabeledNodes(first_labeled_nodes, second_labeled_nodes);
        spdlog::info("Number of Merge Points (min. 2): {}", merge_keyframes.size());
        
        spdlog::info("Calculating optimal transformation of Second DB to merge with First DB...");
        Eigen::Affine3d global_transform = calculateGlobalTransformation_wc(merge_keyframes);

        int32_t id_offset = get_max_id(out_db) + 1; // 0 is a possible keyframe_id, so offset by 1
        spdlog::info("Computed ID Offset: {}", id_offset); 
        if (id_offset == -1) {
            spdlog::error("Failed to fetch max ID of first_db, will not assume that there are none. Aborting.");
            return;
        }

        sqlite3_exec(out_db, "BEGIN TRANSACTION;", nullptr, nullptr, nullptr);

        spdlog::info("Copying nodes...");
        copy_nodes(out_db, second_db, id_offset, global_transform);

        spdlog::info("Copying Edges...");
        copy_edges(out_db, second_db, id_offset);
        
        spdlog::info("Copying Node Locations...");
        copy_node_locations(out_db, second_db, id_offset);
        
        spdlog::info("Copying Special Labels...");
        copy_special_labels(out_db, second_db, id_offset);

        spdlog::info("Connecting Merge Points...");
        create_edge_between_merge_points(out_db, id_offset, merge_keyframes);
        
        sqlite3_exec(out_db, "COMMIT;", nullptr, nullptr, nullptr);

        // Any null zone entries should be 1. from second_db OR the inputter wants to set everything to the same zone
        spdlog::info("Setting unset Zones to {}", zone2_name);
        set_zones(out_db, zone2_name, true);
        
        spdlog::info("Successfully merged databases into {}", out_path);

        // Clean up
        sqlite3_close(first_db);
        sqlite3_close(second_db);
        sqlite3_close(out_db);
    }


    int get_max_id(sqlite3* db) {
        sqlite3_stmt* get_max_id_stmt;
        int ret = sqlite3_prepare_v2(db, "SELECT MAX(keyframe_id) FROM nodes;", -1, &get_max_id_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare MAX id select: {}", sqlite3_errmsg(db));
            return -1;
        }
        int32_t id_offset = -1;
        if (sqlite3_step(get_max_id_stmt) == SQLITE_ROW){
            id_offset = sqlite3_column_int(get_max_id_stmt, 0);
        }
        return id_offset;
    }

    void create_edge_between_merge_points(sqlite3* dst_db, int32_t id_offset, std::vector<std::pair<NodeInfo, NodeInfo>> merge_keyframes){
        sqlite3_stmt* insert_loop_edge_stmt;
        int ret = sqlite3_prepare_v2(dst_db, "INSERT INTO edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, 2)", -1, &insert_loop_edge_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare edges database insert: {}", sqlite3_errmsg(dst_db));
            return;
        }

        for (auto merge_point : merge_keyframes) {
            int32_t id1 = merge_point.first.keyframe_id;
            int32_t id2 = merge_point.second.keyframe_id + id_offset;
            spdlog::info("Creating a loop edge between {} and {}", id1, id2);

            sqlite3_bind_int(insert_loop_edge_stmt, 1, id1 );
            sqlite3_bind_int(insert_loop_edge_stmt, 2, id2 );
            sqlite3_step(insert_loop_edge_stmt);

            sqlite3_reset(insert_loop_edge_stmt);

            // Insert edge going the other direction
            sqlite3_bind_int(insert_loop_edge_stmt, 1, id2 );
            sqlite3_bind_int(insert_loop_edge_stmt, 2, id1 );
            sqlite3_step(insert_loop_edge_stmt);
        }
        sqlite3_finalize(insert_loop_edge_stmt);
    }

    void copy_nodes(sqlite3* dst_db, sqlite3* src_db, int32_t id_offset, Eigen::Affine3d global_transform_wc){
        int ret;
        sqlite3_stmt* insert_node_stmt;
        const char* insert_node_query = "INSERT INTO nodes (ts, keyframe_id, pose, x_trans, y_trans, z_trans, label) VALUES (?, ?, ?, ?, ?, ?, ?)";
        ret = sqlite3_prepare_v2(dst_db, insert_node_query, -1, &insert_node_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare node insert statement: {}", sqlite3_errmsg(dst_db));
            return;
        }

        // Begin transaction for better performance
        sqlite3_exec(dst_db, "BEGIN TRANSACTION", nullptr, nullptr, nullptr);


        // Transfer second database nodes with transformation
        sqlite3_stmt* second_select_stmt;
        ret = sqlite3_prepare_v2(src_db, "SELECT ts, keyframe_id, pose, x_trans, y_trans, z_trans, label FROM nodes", -1, &second_select_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare second database node select: {}", sqlite3_errmsg(src_db));
            return;
        }

        while (sqlite3_step(second_select_stmt) == SQLITE_ROW) {
            // Transform node from second database
            double original_pose[16];
            const void* blob = sqlite3_column_blob(second_select_stmt, 2);
            int blob_size = sqlite3_column_bytes(second_select_stmt, 2);
            memcpy(original_pose, blob, 16 * sizeof(double));
            
            Eigen::Matrix4d pose_cw = Eigen::Map<Eigen::Matrix4d>(original_pose, 4, 4);
            Eigen::Affine3d affine_pose_wc;
            affine_pose_wc.matrix() = pose_cw.inverse();

            Eigen::Affine3d transformed_pose = global_transform_wc * affine_pose_wc;
            pose_cw = transformed_pose.matrix().inverse();

            std::vector<double> pose_vec;
            Mat4dToVec(pose_cw, pose_vec);

            
            // Insert transformed second database nodes
            sqlite3_bind_double(insert_node_stmt, 1, sqlite3_column_double(second_select_stmt, 0));  // ts
            sqlite3_bind_int(insert_node_stmt, 2, id_offset + sqlite3_column_int(second_select_stmt, 1));      // keyframe_id
            sqlite3_bind_blob(insert_node_stmt, 3, pose_vec.data(), pose_vec.size() * sizeof(double), SQLITE_STATIC);  // transformed pose
            
            // Apply transformation to translation
            Eigen::Vector3d trans_vec(
                sqlite3_column_double(second_select_stmt, 3),
                sqlite3_column_double(second_select_stmt, 4),
                sqlite3_column_double(second_select_stmt, 5)
            );
            Eigen::Vector3d transformed_trans = global_transform_wc * trans_vec;

            sqlite3_bind_double(insert_node_stmt, 4, transformed_trans.x());  // x_trans
            sqlite3_bind_double(insert_node_stmt, 5, transformed_trans.y());  // y_trans
            sqlite3_bind_double(insert_node_stmt, 6, transformed_trans.z());  // z_trans
            sqlite3_bind_text(insert_node_stmt, 7, 
                reinterpret_cast<const char*>(sqlite3_column_text(second_select_stmt, 6)), -1, SQLITE_STATIC);  // label

            sqlite3_step(insert_node_stmt);
            sqlite3_reset(insert_node_stmt);
        }
        sqlite3_finalize(second_select_stmt);
        sqlite3_finalize(insert_node_stmt);

        // Commit transaction
        sqlite3_exec(dst_db, "COMMIT;", nullptr, nullptr, nullptr);
    }

    void copy_edges(sqlite3* dst_db, sqlite3* src_db, int32_t id_offset) {
        int ret;
        const char* select_edges_query = R"(
            SELECT keyframe_id0, keyframe_id1, type FROM edges
        )";
        const char* insert_edges_query = R"(
            INSERT INTO edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, ?)
        )";

        sqlite3_stmt* select_edges_stmt;
        sqlite3_stmt* insert_edges_stmt;

        // Prepare SELECT statement on src_db
        ret = sqlite3_prepare_v2(src_db, select_edges_query, -1, &select_edges_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare SELECT edges: {}", sqlite3_errmsg(src_db));
            return;
        }

        // Prepare INSERT statement on out_db
        ret = sqlite3_prepare_v2(dst_db, insert_edges_query, -1, &insert_edges_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare INSERT edges: {}", sqlite3_errmsg(dst_db));
            sqlite3_finalize(select_edges_stmt);
            return;
        }

        // Process edges row by row
        while (sqlite3_step(select_edges_stmt) == SQLITE_ROW) {
            int keyframe_id0 = sqlite3_column_int(select_edges_stmt, 0);
            int keyframe_id1 = sqlite3_column_int(select_edges_stmt, 1);
            int type = sqlite3_column_int(select_edges_stmt, 2);

            // Bind data with id_offset
            sqlite3_bind_int(insert_edges_stmt, 1, keyframe_id0 + id_offset);
            sqlite3_bind_int(insert_edges_stmt, 2, keyframe_id1 + id_offset);
            sqlite3_bind_int(insert_edges_stmt, 3, type);

            if (sqlite3_step(insert_edges_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert edge: {}", sqlite3_errmsg(dst_db));
            }
            sqlite3_reset(insert_edges_stmt); // Reset for next iteration
        }

        sqlite3_finalize(select_edges_stmt);
        sqlite3_finalize(insert_edges_stmt);
    }

    void copy_node_locations(sqlite3* dst_db, sqlite3* src_db, int32_t id_offset) {
        int ret;
        // Copy node locations
        const char* select_nodes_query = R"(
            SELECT keyframe_id, location FROM node_locations
        )";
        const char* insert_nodes_query = R"(
            INSERT INTO node_locations (keyframe_id, location) VALUES (?, ?)
        )";

        sqlite3_stmt* select_nodes_stmt;
        sqlite3_stmt* insert_nodes_stmt;

        // Prepare SELECT and INSERT statements
        ret = sqlite3_prepare_v2(src_db, select_nodes_query, -1, &select_nodes_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare SELECT nodes: {}", sqlite3_errmsg(src_db));
            return;
        }

        ret = sqlite3_prepare_v2(dst_db, insert_nodes_query, -1, &insert_nodes_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare INSERT nodes: {}", sqlite3_errmsg(dst_db));
            sqlite3_finalize(select_nodes_stmt);
            return;
        }

        // Process node locations row by row
        while (sqlite3_step(select_nodes_stmt) == SQLITE_ROW) {
            int keyframe_id = sqlite3_column_int(select_nodes_stmt, 0);
            const unsigned char* location = sqlite3_column_text(select_nodes_stmt, 1);

            // Bind data with id_offset
            sqlite3_bind_int(insert_nodes_stmt, 1, keyframe_id + id_offset);
            sqlite3_bind_text(insert_nodes_stmt, 2, reinterpret_cast<const char*>(location), -1, SQLITE_STATIC);

            if (sqlite3_step(insert_nodes_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert node location: {}", sqlite3_errmsg(dst_db));
            }
            sqlite3_reset(insert_nodes_stmt); // Reset for next iteration
        }

        sqlite3_finalize(select_nodes_stmt);
        sqlite3_finalize(insert_nodes_stmt);
    }

    void copy_special_labels(sqlite3* dst_db, sqlite3* src_db, int32_t id_offset){
        int ret;
        // Copy node locations
        const char* select_labels_query = R"(
            SELECT keyframe_id, label FROM special_labels
        )";
        const char* insert_labels_query = R"(
            INSERT INTO special_labels (keyframe_id, label) VALUES (?, ?)
        )";

        sqlite3_stmt* select_labels_stmt;
        sqlite3_stmt* insert_labels_stmt;

        // Prepare SELECT and INSERT statements
        ret = sqlite3_prepare_v2(src_db, select_labels_query, -1, &select_labels_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare SELECT labels: {}", sqlite3_errmsg(src_db));
            return;
        }

        ret = sqlite3_prepare_v2(dst_db, insert_labels_query, -1, &insert_labels_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare INSERT labels: {}", sqlite3_errmsg(dst_db));
            sqlite3_finalize(select_labels_stmt);
            return;
        }

        // Process special labels row by row
        while (sqlite3_step(select_labels_stmt) == SQLITE_ROW) {
            int keyframe_id = sqlite3_column_int(select_labels_stmt, 0);
            const unsigned char* label = sqlite3_column_text(select_labels_stmt, 1);

            sqlite3_bind_int(insert_labels_stmt, 1, keyframe_id + id_offset);
            sqlite3_bind_text(insert_labels_stmt, 2, reinterpret_cast<const char*>(label), -1, SQLITE_STATIC);

            if (sqlite3_step(insert_labels_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert special point: {}", sqlite3_errmsg(dst_db));
            }
            sqlite3_reset(insert_labels_stmt); // Reset for next iteration
        }

        sqlite3_finalize(select_labels_stmt);
        sqlite3_finalize(insert_labels_stmt);
    }

    bool set_zones(sqlite3* target_db, std::string zone_name, bool only_nulls) {
        spdlog::info("Updating all 'zone' names in the database with: {}, (only nulls: {})...", zone_name, only_nulls);
        std::string update_nodes_only_nulls = "UPDATE nodes SET zone = '"+ zone_name+"' WHERE zone IS NULL;";
        std::string update_edges_only_nulls = "UPDATE edges SET zone = '" + zone_name + "' WHERE zone IS NULL;";
        std::string update_locations_only_nulls = "UPDATE node_locations SET zone = '"+ zone_name +"' WHERE zone IS NULL;";
        std::string special_labels_only_nulls = "UPDATE special_labels SET zone = '"+ zone_name +"' WHERE zone IS NULL;";
        std::string update_nodes = "UPDATE nodes SET zone = '" + zone_name + "';";
        std::string update_edges = "UPDATE edges SET zone = '" + zone_name + "';";
        std::string update_locations = "UPDATE node_locations SET zone = '" + zone_name + "';";
        std::string special_labels = "UPDATE special_labels SET zone = '" + zone_name + "';";

        if (only_nulls) {
            sqlite3_exec(target_db, update_nodes_only_nulls.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, update_edges_only_nulls.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, update_locations_only_nulls.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, special_labels_only_nulls.c_str(), nullptr, nullptr, nullptr);
        }
        else {
            sqlite3_exec(target_db, update_nodes.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, update_edges.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, update_locations.c_str(), nullptr, nullptr, nullptr);
            sqlite3_exec(target_db, special_labels.c_str(), nullptr, nullptr, nullptr);
        }
        spdlog::info("Updated.");
        return true;
    }

public:
    MapMerger(const std::string& first_path, const std::string& second_path) {
        // Open first and second databases
        int ret = sqlite3_open(first_path.c_str(), &first_db);
        if (ret != SQLITE_OK) {
            spdlog::error("Cannot open first input database: {}", sqlite3_errmsg(first_db));
            throw std::runtime_error("Failed to open first database");
        }

        ret = sqlite3_open(second_path.c_str(), &second_db);
        if (ret != SQLITE_OK) {
            spdlog::error("Cannot open second input database: {}", sqlite3_errmsg(second_db));
            throw std::runtime_error("Failed to open second database");
        }
    }

    void merge(const std::string& out_path, const std::string zone1_name, const std::string zone2_name) {
        mergeDatabase(out_path, zone1_name, zone2_name);
    }

    ~MapMerger() {
        if (first_db) sqlite3_close(first_db);
        if (second_db) sqlite3_close(second_db);
        if (out_db) sqlite3_close(out_db);
    }
};


int main(int argc, char** argv) {
    po::options_description desc("Allowed options");
    desc.add_options()
        ("help,h", "produce help message")
        ("first,f,1", po::value<std::string>()->required(), "First map to merge")
        ("zone1,z1", po::value<std::string>()->default_value(""), "(Optional) Sets the Zone name of DB 1 - Will overwrite all zone name, so only use on raw SLAM_TO_SQLITE outputs of runCampusVirtual")
        ("zone2,z2", po::value<std::string>()->required(), "Name of Zone to assign db 2 to - sets all NULL zones to this, so if DB 1 has NULLs these will be given this name")
        ("second,s,2", po::value<std::string>()->required(), "Second map to merge")
        ("out,o", po::value<std::string>()->required(), "Output map name")
        ("manual,m", po::value<bool>()->default_value(false), "Merge using Iridesence Viewer to align and rotate")
        ("overwrite", po::bool_switch(), "If Out file already exists, overwrite it");

    po::positional_options_description pos_desc;
    pos_desc.add("first", 1);
    pos_desc.add("second", 1);
    pos_desc.add("out", 1);

    po::variables_map vm;
    try {
        po::store(po::command_line_parser(argc, argv).options(desc).positional(pos_desc).run(), vm);
        po::notify(vm);

        if (vm.count("help")) {
            std::cout << desc << std::endl;
            return 1;
        }

        std::string first_map_file = vm["first"].as<std::string>();
        std::string second_map_file = vm["second"].as<std::string>();
        std::string out_map_file = vm["out"].as<std::string>();
        bool overwrite = vm["overwrite"].as<bool>();

        // Check file existence and handle overwrite
        if (!fs::exists(first_map_file)) {
            std::cerr << "Cannot find first map file" << std::endl;
            return 1;
        }

        if (!fs::exists(second_map_file)) {
            std::cerr << "Cannot find second map file" << std::endl;
            return 1;
        }

        if (fs::exists(out_map_file) && !overwrite) {
            std::cerr << "Output file exists. Use --overwrite to force." << std::endl;
            return 1;
        }

        std::string zone1_name = vm["zone1"].as<std::string>();
        std::string zone2_name = vm["zone2"].as<std::string>();

        if (zone2_name.size() == 0) {
            std::cerr << "Zone 2 name cannot be empty" << std::endl;
            return 1;
        }


        boost::filesystem::copy_file(first_map_file, out_map_file, boost::filesystem::copy_options::overwrite_existing);


        MapMerger merger(first_map_file, second_map_file);

        merger.merge(out_map_file, zone1_name, zone2_name);

    } catch (const po::error& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}   