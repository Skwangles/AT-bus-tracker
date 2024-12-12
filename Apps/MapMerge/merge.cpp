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

namespace po = boost::program_options;
namespace fs = boost::filesystem;

struct NodeInfo {
    int keyframe_id;
    double ts;
    Eigen::Affine3d pose;
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
        std::string query = "SELECT keyframe_id, ts, pose, x_trans, y_trans, z_trans, label "
                            "FROM nodes WHERE label LIKE '" + prefix + "%'";
        
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
            // You might need a custom deserialization method depending on your exact serialization
            
            node.x_trans = sqlite3_column_double(stmt, 3);
            node.y_trans = sqlite3_column_double(stmt, 4);
            node.z_trans = sqlite3_column_double(stmt, 5);
            
            const unsigned char* label = sqlite3_column_text(stmt, 6);
            node.label = label ? reinterpret_cast<const char*>(label) : "";

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

      Eigen::Affine3d calculateGlobalTransformation_SVD(
        const std::vector<std::pair<NodeInfo, NodeInfo>>& matching_nodes
    ) {
        if (matching_nodes.empty()) {
            spdlog::error("No matching labeled nodes found");
            return Eigen::Affine3d::Identity();
        }

        // Use Procrustes analysis or similar method to find best alignment
        // This is a simplified version and might need more sophisticated alignment
        Eigen::MatrixXd first_points(3, matching_nodes.size());
        Eigen::MatrixXd second_points(3, matching_nodes.size());

        for (size_t i = 0; i < matching_nodes.size(); ++i) {
            const auto& first_node = matching_nodes[i].first;
            const auto& second_node = matching_nodes[i].second;

            first_points.col(i) << first_node.x_trans, first_node.y_trans, first_node.z_trans;
            second_points.col(i) << second_node.x_trans, second_node.y_trans, second_node.z_trans;
        }

        // Compute centroids
        Eigen::Vector3d first_centroid = first_points.rowwise().mean();
        Eigen::Vector3d second_centroid = second_points.rowwise().mean();

        // Center the points
        first_points.colwise() -= first_centroid;
        second_points.colwise() -= second_centroid;

        // Compute cross-covariance matrix
        Eigen::MatrixXd H = first_points * second_points.transpose();
        Eigen::JacobiSVD<Eigen::MatrixXd> svd(H, Eigen::ComputeFullU | Eigen::ComputeFullV);

        // Compute rotation
        Eigen::Matrix3d rotation = svd.matrixV() * svd.matrixU().transpose();
        if (rotation.determinant() < 0) {
            rotation.col(2) *= -1;
        }

        // Compute translation
        Eigen::Vector3d translation = first_centroid - rotation * second_centroid;

        // Construct transformation
        Eigen::Affine3d global_transform = Eigen::Affine3d::Identity();
        global_transform.linear() = rotation;
        global_transform.translation() = translation;

        return global_transform;
    }

    // Calculate global transformation with Y-axis only rotation
    Eigen::Affine3d calculateGlobalTransformation(
        const std::vector<std::pair<NodeInfo, NodeInfo>>& matching_nodes
    ) {
        if (matching_nodes.empty()) {
            spdlog::error("No matching labeled nodes found");
            return Eigen::Affine3d::Identity();
        }

        // Compute horizontal rotation angle (only around Y-axis)
        Eigen::Vector2d first_vec, second_vec;
        
        // First compute vectors between points
        std::vector<Eigen::Vector2d> first_vecs, second_vecs;
        for (size_t i = 0; i < matching_nodes.size(); ++i) {
            for (size_t j = i + 1; j < matching_nodes.size(); ++j) {
                Eigen::Vector2d first_diff(
                    matching_nodes[j].first.x_trans - matching_nodes[i].first.x_trans,
                    matching_nodes[j].first.z_trans - matching_nodes[i].first.z_trans
                );
                Eigen::Vector2d second_diff(
                    matching_nodes[j].second.x_trans - matching_nodes[i].second.x_trans,
                    matching_nodes[j].second.z_trans - matching_nodes[i].second.z_trans
                );
                
                first_vecs.push_back(first_diff);
                second_vecs.push_back(second_diff);
            }
        }

        // Compute average rotation angle
        double total_angle = 0.0;
        int angle_count = 0;

        for (size_t i = 0; i < first_vecs.size(); ++i) {
            // Compute angle between vectors
            double first_angle = std::atan2(first_vecs[i].y(), first_vecs[i].x());
            double second_angle = std::atan2(second_vecs[i].y(), second_vecs[i].x());
            
            // Compute rotation needed to align these
            double rotation_angle = first_angle - second_angle;
            
            total_angle += rotation_angle;
            angle_count++;
        }

        // Average rotation angle
           Eigen::Vector3d translation_diff(
                match.first.x_trans - rotated_point.x(),
                0.0,  // No vertical translation
                match.first.z_trans - rotated_point.y()
            );

            translation_offset += translation_diff;
            offset_count++;
        }

        // Average translation
        translation_offset /= offset_count;

        // Construct transformation
        Eigen::Affine3d global_transform = Eigen::Affine3d::Identity();
        
        // Rotation matrix for Y-axis rotation
        Eigen::Matrix3d rotation_matrix = Eigen::AngleAxisd(avg_rotation, Eigen::Vector3d::UnitY()).toRotationMatrix();
        global_transform.linear() = rotation_matrix;
        
        // Set translation
        global_transform.translation() = translation_offset;

        return global_transform;
    }


    void mergeDatabase(const std::string& out_path) {
        // Open databases
        int ret = sqlite3_open(out_path.c_str(), &out_db);
        if (ret != SQLITE_OK) {
            spdlog::error("Cannot open output database: {}", sqlite3_errmsg(out_db));
            return;
        }

        // Extract labeled nodes from both databases
        auto first_labeled_nodes = extractLabeledNodes(first_db);
        auto second_labeled_nodes = extractLabeledNodes(second_db);

        // Find matching labeled nodes
        auto matching_nodes = findMatchingLabeledNodes(first_labeled_nodes, second_labeled_nodes);

        // Calculate global transformation
        Eigen::Affine3d global_transform = calculateGlobalTransformation(matching_nodes);

        // TODO: Implement database merging logic
        // This would involve:
        // 1. Transforming all nodes from second_db using global_transform
        // 2. Inserting transformed nodes and edges into out_db
      `  // Prepare insert statement for nodes
        sqlite3_stmt* insert_node_stmt;
        const char* insert_node_query = "INSERT INTO nodes (ts, keyframe_id, pose, x_trans, y_trans, z_trans, label) VALUES (?, ?, ?, ?, ?, ?, ?)";
        ret = sqlite3_prepare_v2(out_db, insert_node_query, -1, &insert_node_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare node insert statement: {}", sqlite3_errmsg(out_db));
            return;
        }

        // Begin transaction for better performance
        sqlite3_exec(out_db, "BEGIN TRANSACTION", nullptr, nullptr, nullptr);

        // Transfer first database nodes -- 
        /// Note: This is commented because out_db should already be a duplicate of first_db
        // sqlite3_stmt* first_select_stmt;
        // ret = sqlite3_prepare_v2(first_db, "SELECT * FROM nodes", -1, &first_select_stmt, nullptr);
        // if (ret != SQLITE_OK) {
        //     spdlog::error("Failed to prepare first database node select: {}", sqlite3_errmsg(first_db));
        //     return;
        // }

        // while (sqlite3_step(first_select_stmt) == SQLITE_ROW) {
        //     // Insert first database nodes directly
        //     sqlite3_bind_double(insert_node_stmt, 1, sqlite3_column_double(first_select_stmt, 1));  // ts
        //     sqlite3_bind_int(insert_node_stmt, 2, sqlite3_column_int(first_select_stmt, 0));      // keyframe_id
        //     sqlite3_bind_blob(insert_node_stmt, 3, sqlite3_column_blob(first_select_stmt, 2), sqlite3_column_bytes(first_select_stmt, 2), SQLITE_STATIC);  // pose
        //     sqlite3_bind_double(insert_node_stmt, 4, sqlite3_column_double(first_select_stmt, 3));  // x_trans
        //     sqlite3_bind_double(insert_node_stmt, 5, sqlite3_column_double(first_select_stmt, 4));  // y_trans
        //     sqlite3_bind_double(insert_node_stmt, 6, sqlite3_column_double(first_select_stmt, 5));  // z_trans
        //     sqlite3_bind_text(insert_node_stmt, 7, 
        //         reinterpret_cast<const char*>(sqlite3_column_text(first_select_stmt, 6)), -1, SQLITE_STATIC);  // label

        //     sqlite3_step(insert_node_stmt);
        //     sqlite3_reset(insert_node_stmt);
        // }
        // sqlite3_finalize(first_select_stmt);

        // Transfer second database nodes with transformation
        sqlite3_stmt* second_select_stmt;
        ret = sqlite3_prepare_v2(second_db, "SELECT * FROM nodes", -1, &second_select_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare second database node select: {}", sqlite3_errmsg(second_db));
            return;
        }

        while (sqlite3_step(second_select_stmt) == SQLITE_ROW) {
            // Transform node from second database
            Eigen::Affine3d original_pose(Eigen::Matrix4d::Zero());
            const void* blob = sqlite3_column_blob(second_select_stmt, 2);
            int blob_size = sqlite3_column_bytes(second_select_stmt, 2);
            
            // Reconstruct original pose matrix (simplified, may need custom serialization)
            memcpy(original_pose.data(), blob, std::min(static_cast<size_t>(blob_size), sizeof(Eigen::Matrix4d)));
            
            Eigen::Affine3d transformed_pose = global_transform * original_pose;

            // Serialize transformed pose
            Eigen::Matrix4d transformed_matrix = transformed_pose.matrix();
            
            // Insert transformed second database nodes
            sqlite3_bind_double(insert_node_stmt, 1, sqlite3_column_double(second_select_stmt, 1));  // ts
            sqlite3_bind_int(insert_node_stmt, 2, sqlite3_column_int(second_select_stmt, 0));      // keyframe_id
            sqlite3_bind_blob(insert_node_stmt, 3, transformed_matrix.data(), sizeof(Eigen::Matrix4d), SQLITE_STATIC);  // transformed pose
            
            // Apply transformation to translation
            Eigen::Vector3d trans_vec(
                sqlite3_column_double(second_select_stmt, 3),
                sqlite3_column_double(second_select_stmt, 4),
                sqlite3_column_double(second_select_stmt, 5)
            );
            Eigen::Vector3d transformed_trans = global_transform * trans_vec;

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
        sqlite3_exec(out_db, "COMMIT TRANSACTION", nullptr, nullptr, nullptr);

        // Transfer edges and node_locations (you might want to adjust keyframe_ids)
        // This is a simplified transfer, you may need more complex logic
        const char* transfer_edges_query = R"(
            INSERT INTO edges SELECT * FROM edges IN first_db
            UNION
            SELECT * FROM edges IN second_db
        )";

        const char* transfer_node_locations_query = R"(
            INSERT INTO node_locations SELECT * FROM node_locations IN first_db
            UNION
            SELECT * FROM node_locations IN second_db
        )";

        sqlite3_exec(out_db, transfer_edges_query, nullptr, nullptr, nullptr);
        sqlite3_exec(out_db, transfer_node_locations_query, nullptr, nullptr, nullptr);

        spdlog::info("Successfully merged databases into {}", out_path);
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

    void merge(const std::string& out_path) {
        mergeDatabase(out_path);
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
        ("second,s,2", po::value<std::string>()->required(), "Second map to merge")
        ("out,o", po::value<std::string>()->required(), "Output map name")
        ("manual,m", po::value<bool>()->default_value(false), "Merge using Iridesence Viewer to align and rotate")
        ("overwrite", po::value<bool>()->default_value(false), "If Out file already exists, overwrite it");

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

        MapMerger merger(first_map_file, second_map_file);
        merger.merge(out_map_file);

    } catch (const po::error& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}   Eigen::Vector3d translation_offset = Eigen::Vector3d::Zero();
        int offset_count = 0;

        for (const auto& match : matching_nodes) {
            // Rotate second node's position
            Eigen::Rotation2D<double> rot(avg_rotation);
            Eigen::Vector2d rotated_point(match.second.x_trans, match.second.z_trans);
            rotated_point = rot * rotated_point;

            // Compute translation needed
            Eigen::Vector3d translation_diff(
                match.first.x_trans - rotated_point.x(),
                0.0,  // No vertical translation
                match.first.z_trans - rotated_point.y()
            );

            translation_offset += translation_diff;
            offset_count++;
        }

        // Average translation
        translation_offset /= offset_count;

        // Construct transformation
        Eigen::Affine3d global_transform = Eigen::Affine3d::Identity();
        
        // Rotation matrix for Y-axis rotation
        Eigen::Matrix3d rotation_matrix = Eigen::AngleAxisd(avg_rotation, Eigen::Vector3d::UnitY()).toRotationMatrix();
        global_transform.linear() = rotation_matrix;
        
        // Set translation
        global_transform.translation() = translation_offset;

        return global_transform;
    }

    void mergeDatabase(const std::string& out_path) {
        // Open databases
        int ret = sqlite3_open(out_path.c_str(), &out_db);
        if (ret != SQLITE_OK) {
            spdlog::error("Cannot open output database: {}", sqlite3_errmsg(out_db));
            return;
        }

        // Extract labeled nodes from both databases
        auto first_labeled_nodes = extractLabeledNodes(first_db);
        auto second_labeled_nodes = extractLabeledNodes(second_db);

        // Find matching labeled nodes
        auto matching_nodes = findMatchingLabeledNodes(first_labeled_nodes, second_labeled_nodes);

        // Calculate global transformation
        Eigen::Affine3d global_transform = calculateGlobalTransformation(matching_nodes);

        // TODO: Implement database merging logic
        // This would involve:
        // 1. Transforming all nodes from second_db using global_transform
        // 2. Inserting transformed nodes and edges into out_db
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

    void merge(const std::string& out_path) {
        mergeDatabase(out_path);
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
        ("second,s,2", po::value<std::string>()->required(), "Second map to merge")
        ("out,o", po::value<std::string>()->required(), "Output map name")
        ("manual,m", po::value<bool>()->default_value(false), "Merge using Iridesence Viewer to align and rotate")
        ("overwrite", po::value<bool>()->default_value(false), "If Out file already exists, overwrite it");

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

        MapMerger merger(first_map_file, second_map_file);
        merger.merge(out_map_file);

    } catch (const po::error& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}