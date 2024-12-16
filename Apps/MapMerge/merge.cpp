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

 Eigen::Affine3d calculateGlobalTransformation(
    const std::vector<std::pair<NodeInfo, NodeInfo>>& matching_nodes
) {
    if (matching_nodes.size() < 2) {
        throw std::invalid_argument("At least two matching nodes are required.");
    }

    // Extract positions of the matching points into Eigen matrices.
    size_t num_points = matching_nodes.size();
    std::cout << "Num Merge Points: " << num_points << std::endl;
    Eigen::MatrixXd points_cloud1(3, num_points);
    Eigen::MatrixXd points_cloud2(3, num_points);

    for (size_t i = 0; i < num_points; ++i) {
        std::cout << i << "th Matching Pair ID1: "<< matching_nodes[i].first.keyframe_id << " X:" << matching_nodes[i].first.x_trans << " Pose: \n" << matching_nodes[i].first.pose.block<1,1>(0, 3) << " ID2:" << matching_nodes[i].second.keyframe_id << " X:" << matching_nodes[i].second.x_trans << " Pose: \n" << matching_nodes[i].second.pose.block<1,1>(0, 3) << std::endl;
        std::cout << "Pose: #1\n" << matching_nodes[i].first.pose << " | #2\n" << matching_nodes[i].second.pose << std::endl;

        points_cloud1.col(i) << matching_nodes[i].first.x_trans,matching_nodes[i].first.y_trans,  matching_nodes[i].first.z_trans;
        points_cloud2.col(i) << matching_nodes[i].second.x_trans,matching_nodes[i].second.y_trans,  matching_nodes[i].second.z_trans;
        std::cout << i << "th Position: 1st: \n" << points_cloud1.col(i) << "| 2nd:\n" << points_cloud2.col(i) << std::endl;
    }

    // Compute centroids of both point sets.
    Eigen::Vector3d centroid_cloud1 = points_cloud1.rowwise().mean();
    Eigen::Vector3d centroid_cloud2 = points_cloud2.rowwise().mean();

    std::cout << "Centroids: #1\n" << centroid_cloud1 << " \n| #2\n" << centroid_cloud2 << std::endl;

    // Center the points around the centroids.
    Eigen::MatrixXd centered_cloud1 = points_cloud1.colwise() - centroid_cloud1;
    Eigen::MatrixXd centered_cloud2 = points_cloud2.colwise() - centroid_cloud2;
    std::cout << "Centred points: #1 \n" << centroid_cloud1 << " \n| #2 \n" << centroid_cloud2 << std::endl;



    // Compute the 2D covariance matrix in the XZ plane.
    Eigen::Matrix2d covariance = Eigen::Matrix2d::Zero();
    for (size_t i = 0; i < num_points; i++) {

        std::cout << "Shape of point "<< centroid_cloud1.size() << " " << i << std::endl;

        auto vec1_x = centered_cloud1(0, i);
        auto vec1_z = centered_cloud1(2, i);
        auto vec2_x = centered_cloud2(0, i);
        auto vec2_z = centered_cloud2(2, i);
        
        Eigen::Vector2d vec1(vec1_x, vec1_z), vec2(vec2_x, vec2_z);


        std::cout << "Vec1:\n" << vec1 << "\nVec2:\n " << vec2.transpose() << " \n Result:\n" << vec1 * vec2.transpose() << std::endl;
        covariance += vec1 * vec2.transpose();
    }
    std::cout << "Covarience" << covariance << std::endl;

    // Perform Singular Value Decomposition (SVD) to find the rotation.
    Eigen::JacobiSVD<Eigen::Matrix2d> svd(covariance, Eigen::ComputeFullU | Eigen::ComputeFullV);
    Eigen::Matrix2d rotation_2d = svd.matrixU() * svd.matrixV().transpose();

    // Ensure the rotation matrix is a proper rotation (det = 1).
    if (rotation_2d.determinant() < 0) {
        rotation_2d.col(1) *= -1;
    }

    // Embed the 2D rotation into a 3D rotation matrix (Z-axis rotation).
    Eigen::Matrix3d rotation = Eigen::Matrix3d::Identity();
    rotation(0, 0) = rotation_2d(0, 0);
    rotation(0, 2) = rotation_2d(0, 1);
    rotation(2, 0) = rotation_2d(1, 0);
    rotation(2, 2) = rotation_2d(1, 1);
    std::cout << rotation << std::endl;

    // Compute the translation.
    Eigen::Vector3d translation = centroid_cloud1 - rotation * centroid_cloud2;

    // Construct the affine transformation (rotation + translation).
    Eigen::Affine3d transformation = Eigen::Affine3d::Identity();
    transformation.linear() = rotation;
    transformation.translation() = translation;

    std::cout << "Transformation: " << rotation << " | " << translation << " |" << std::endl;
    return transformation;
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
        std::cout << "Check that the IDs are different: " << matching_nodes[0].first.keyframe_id << " " << matching_nodes[0].second.keyframe_id << std::endl;

        // Calculate global transformation
        Eigen::Affine3d global_transform = calculateGlobalTransformation(matching_nodes);

        

        // TODO: Implement database merging logic
        // This would involve:
        // 1. Transforming all nodes from second_db using global_transform
        // 2. Inserting transformed nodes and edges into out_db
        // Prepare insert statement for nodes
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

        sqlite3_stmt* get_max_id_stmt;
        ret = sqlite3_prepare_v2(first_db, "SELECT MAX(keyframe_id) FROM nodes;", -1, &get_max_id_stmt, nullptr);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to prepare MAX id select: {}", sqlite3_errmsg(first_db));
            return;
        }
        int32_t max_id = -1;
        if (sqlite3_step(get_max_id_stmt) == SQLITE_ROW){
            max_id = sqlite3_column_int(get_max_id_stmt, 0);
        }

        if (max_id == -1) {
            spdlog::error("Failed to fetch max ID of first_db, will not assume that there are none. Aborting.");
            return;
        }



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
            sqlite3_bind_int(insert_node_stmt, 2, max_id + sqlite3_column_int(second_select_stmt, 0));      // keyframe_id
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
        // const char* transfer_edges_query = R"(
        //     INSERT INTO edges SELECT keyframe_id0 + ?, keyframe_id1 + ?, * FROM edges IN first_db
        //     UNION
        //     SELECT * FROM edges IN second_db
        // )";

        // const char* transfer_node_locations_query = R"(
        //     INSERT INTO node_locations SELECT * FROM node_locations IN first_db
        //     UNION
        //     SELECT * FROM node_locations IN second_db
        // )";

        // sqlite3_exec(out_db, transfer_edges_query, nullptr, nullptr, nullptr);
        // sqlite3_exec(out_db, transfer_node_locations_query, nullptr, nullptr, nullptr);

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

    void merge(const std::string& out_path, const std::string zone1_name, const std::string zone2_name) {
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
        ("zone1,z1", po::value<std::string>(), "(Optional) Name of Zone to assign db 1 to (will overwrite previous zone names) - e.g. so you know what zone a point was merged from")
        ("zone2,z2", po::value<std::string>(), "(Optional) Name of Zone to assign db 2 to (will overwrite previous zone name) - e.g. so you know what zone a point was merged from")
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

        boost::filesystem::copy_file(first_map_file, out_map_file, boost::filesystem::copy_options::overwrite_existing);


        MapMerger merger(first_map_file, second_map_file);

        merger.merge(out_map_file, vm.count("zone1") > 0 ? vm["zone1"].as<std::string>() : NULL, vm.count("zone2") > 0 ? vm["zone2"].as<std::string>() : 0);

    } catch (const po::error& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}   