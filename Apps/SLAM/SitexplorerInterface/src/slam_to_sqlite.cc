#include "sitexplorer_socket_publisher/publisher.h"

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/publish/map_publisher.h"
#include "stella_vslam/util/yaml.h"
#include "stella_vslam/data/keyframe.h"

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>
#include <memory>
#include <vector>
#include <unordered_map>
#include <forward_list>

#include <stdexcept>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>

#include <string>

#include "util/save_to_db.hpp"
#include "util/elevator.hpp"

#include <sqlite3.h>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

// Function to create basic tables in SQLite
void create_basic_tables_if_not_exist(sqlite3* db) {
    char* err_msg = nullptr;
    
    const char* sql = R"(
        DROP TABLE IF EXISTS nodes;
        DROP TABLE IF EXISTS edges;
        DROP TABLE IF EXISTS node_locations;
        DROP TABLE IF EXISTS user_defined_labels;

        CREATE TABLE nodes (
            ts NUMERIC NOT NULL,
            keyframe_id INTEGER PRIMARY KEY,
            pose BLOB NOT NULL,
            x_trans REAL,
            y_trans REAL,
            z_trans REAL,
            zone TEXT DEFAULT NULL
        );

        CREATE TABLE user_defined_labels (
            keyframe_id INTEGER NOT NULL,
            label TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id) ON DELETE CASCADE,
            PRIMARY KEY (label, keyframe_id)
        );

        CREATE TABLE edges (
            keyframe_id0 INTEGER NOT NULL,
            keyframe_id1 INTEGER NOT NULL,
            type INTEGER DEFAULT 2,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id0) REFERENCES nodes(keyframe_id) ON DELETE CASCADE,
            FOREIGN KEY (keyframe_id1) REFERENCES nodes(keyframe_id) ON DELETE CASCADE,
            UNIQUE(keyframe_id0, keyframe_id1),
            PRIMARY KEY (keyframe_id0, keyframe_id1)
        );

        CREATE TABLE node_locations (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            location TEXT,
            zone TEXT DEFAULT NULL,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id) ON DELETE CASCADE
        );
    )";

    int rc = sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
    if (rc != SQLITE_OK) {
        spdlog::error("SQL error: {}", err_msg);
        sqlite3_free(err_msg);
    }

    // Use elevator.hpp function to create additional tables and modify existing ones
    if (!create_tables_if_not_exist(db)) {
        spdlog::error("Failed to create elevator-related tables");
    }
}

void user_defined_labels_to_sqlite(sqlite3* db, const std::string& map_db_path) {
    sqlite3* source_db = nullptr;
    int ret = sqlite3_open(map_db_path.c_str(), &source_db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open source SQL database");
        return;
    }
    std::vector<timestamp_annotation> user_defined_points;
    load_user_defined_point_timestamps(source_db, user_defined_points);

    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT keyframe_id FROM nodes WHERE ABS(ts - ?) < 0.00001 LIMIT 1";
    ret = sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to prepare select statement: {}", sqlite3_errmsg(db));
        sqlite3_close(source_db);
        return;
    }

    sqlite3_stmt* insert_stmt = nullptr;
    const char* insert_sql = "INSERT INTO user_defined_labels (keyframe_id, label) VALUES (?, ?)";
    ret = sqlite3_prepare_v2(db, insert_sql, -1, &insert_stmt, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to prepare insert statement: {}", sqlite3_errmsg(db));
        sqlite3_close(source_db);
        return;
    }

    sqlite3_stmt* fetch_closest_timestamp = nullptr;
    const char* closest_id_sql = "SELECT id, ts FROM keyframes ORDER BY ABS(? - ts) LIMIT 1";
    ret = sqlite3_prepare_v2(source_db, closest_id_sql, -1, &fetch_closest_timestamp, nullptr);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to prepare 'fetch closest ts' statement: {}", sqlite3_errmsg(db));
        sqlite3_close(source_db);
        return;
    }

    for (const timestamp_annotation& user_defined_point : user_defined_points) {
        sqlite3_bind_double(stmt, 1, user_defined_point.timestamp);
        
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int id = sqlite3_column_int(stmt, 0);
            spdlog::info("User Defined Label - Paired ts: {} with keyframe id {}", user_defined_point.timestamp, id);
            
            sqlite3_bind_int(insert_stmt, 1, id);
            sqlite3_bind_text(insert_stmt, 2, user_defined_point.group.c_str(), -1, SQLITE_STATIC);
            
            if (sqlite3_step(insert_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert user defined label: {}", sqlite3_errmsg(db));
            }
            
            sqlite3_reset(insert_stmt);
            sqlite3_clear_bindings(insert_stmt);
        } else {
            // Since videos are passed in sequentially, the closest timestamp should be the next best point
            sqlite3_bind_double(fetch_closest_timestamp, 1, user_defined_point.timestamp);

            if (sqlite3_step(fetch_closest_timestamp) == SQLITE_ROW) {
                int closest_id = sqlite3_column_int(fetch_closest_timestamp, 0);
                
                sqlite3_bind_int(insert_stmt, 1, closest_id);
                sqlite3_bind_text(insert_stmt, 2, user_defined_point.group.c_str(), -1, SQLITE_STATIC);

                if (sqlite3_step(insert_stmt) != SQLITE_DONE) {
                    spdlog::error("The original matched timestamp doesn't exist, and there are no more closest points: {}", sqlite3_errmsg(db));
                }
                sqlite3_reset(insert_stmt);
                sqlite3_clear_bindings(insert_stmt);
            }
            else {
                spdlog::warn("User Defined Label - Could not find a timestamp match for {} of label {}", user_defined_point.timestamp, user_defined_point.group);
            }
            sqlite3_reset(fetch_closest_timestamp);
            sqlite3_clear_bindings(fetch_closest_timestamp);
        }
        
        sqlite3_reset(stmt);
        sqlite3_clear_bindings(stmt);
    }

    sqlite3_finalize(stmt);
    sqlite3_finalize(insert_stmt);
    sqlite3_close(source_db);
}

void timestamp_groups_to_sqlite(sqlite3* db, const std::string& map_db_path) {
    sqlite3* source_db = nullptr;
    int ret = sqlite3_open(map_db_path.c_str(), &source_db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open source SQL database");
        return;
    }
    std::vector<timestamp_annotation> node_locations;
    load_timestamp_groups(source_db, node_locations);

    sqlite3_stmt* stmt = nullptr;
    const char* sql = "SELECT keyframe_id FROM nodes WHERE ABS(ts - ?) < 0.00001 LIMIT 1";
    ret = sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to prepare statement: {}", sqlite3_errmsg(db));
        sqlite3_close(source_db);
        return;
    }

    sqlite3_stmt* insert_stmt = nullptr;
    const char* insert_sql = "INSERT INTO node_locations (keyframe_id, location) VALUES (?, ?)";
    ret = sqlite3_prepare_v2(db, insert_sql, -1, &insert_stmt, nullptr);

    if (ret != SQLITE_OK) {
        spdlog::error("Failed to prepare insert statement: {}", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        sqlite3_close(source_db);
        return;
    }

    for (const timestamp_annotation& node_loc : node_locations) {
        sqlite3_bind_double(stmt, 1, node_loc.timestamp);
        
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int id = sqlite3_column_int(stmt, 0);
            std::cout << "Group - Paired ts " << node_loc.timestamp << " with keyframe_id " << id << std::endl;
            
            sqlite3_bind_int(insert_stmt, 1, id);
            sqlite3_bind_text(insert_stmt, 2, node_loc.group.c_str(), -1, SQLITE_STATIC);
            
            if (sqlite3_step(insert_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert node location: {}", sqlite3_errmsg(db));
            }
            
            sqlite3_reset(insert_stmt);
            sqlite3_clear_bindings(insert_stmt);
        } else {
            std::cout << "Group - Could not find a timestamp match for " << node_loc.timestamp << " of group " << node_loc.group << std::endl;
        }
        
        sqlite3_reset(stmt);
        sqlite3_clear_bindings(stmt);
    }

    sqlite3_finalize(stmt);
    sqlite3_finalize(insert_stmt);
    sqlite3_close(source_db);
}

void process_user_defined_labels_to_other_nodes(sqlite3* db) {
    // Use the elevator.hpp function to convert user defined labels
    if (!convert_user_defined_labels_to_other_nodes(db)) {
        spdlog::error("Failed to convert user defined labels to other nodes");
    }
}

void convert_to_sqlite(const std::shared_ptr<stella_vslam::system>& slam,
                      const std::shared_ptr<stella_vslam::config>& cfg,
                      const std::string& map_db_path,
                      const std::string& output_db_path) {

    sqlite3* db = nullptr;
    int ret = sqlite3_open(output_db_path.c_str(), &db);
    if (ret != SQLITE_OK) {
        spdlog::error("Cannot open database: {}", sqlite3_errmsg(db));
        return;
    }

    std::cout << "Connected to database" << std::endl;
    
    create_basic_tables_if_not_exist(db);

    // Begin transaction
    char* err_msg = nullptr;
    ret = sqlite3_exec(db, "BEGIN TRANSACTION", nullptr, nullptr, &err_msg);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to begin transaction: {}", err_msg);
        sqlite3_free(err_msg);
        sqlite3_close(db);
        return;
    }

    // Prepare statements
    sqlite3_stmt* node_stmt = nullptr;
    const char* node_sql = "INSERT INTO nodes (keyframe_id, ts, pose, x_trans, y_trans, z_trans) VALUES (?, ?, ?, ?, ?, ?)";
    ret = sqlite3_prepare_v2(db, node_sql, -1, &node_stmt, nullptr);
    
    sqlite3_stmt* edge_stmt = nullptr;
    const char* edge_sql = "INSERT OR IGNORE INTO edges (keyframe_id0, keyframe_id1, type) VALUES (?, ?, ?)";
    ret = sqlite3_prepare_v2(db, edge_sql, -1, &edge_stmt, nullptr);

    std::vector<std::shared_ptr<stella_vslam::data::keyframe>> keyfrms;
    slam->get_map_publisher()->get_keyframes(keyfrms);

    for (const auto& keyfrm : keyfrms) {
        if (!keyfrm || keyfrm->will_be_erased()) {
            continue;
        }

        const auto id = keyfrm->id_;
        const auto ts = keyfrm->timestamp_;
        const auto pose = keyfrm->get_pose_cw();
        const stella_vslam::Vec3_t trans = keyfrm->get_trans_wc();

        std::vector<double> pose_vec;
        for (int i = 0; i < 16; i++) {
            int ir = i / 4;
            int il = i % 4;
            pose_vec.push_back(pose(ir, il));

        }

        sqlite3_bind_int(node_stmt, 1, id);
        sqlite3_bind_double(node_stmt, 2, ts);
        sqlite3_bind_blob(node_stmt, 3, pose_vec.data(), pose_vec.size() * sizeof(double), SQLITE_STATIC);
        sqlite3_bind_double(node_stmt, 4, trans(0));
        sqlite3_bind_double(node_stmt, 5, trans(1));
        sqlite3_bind_double(node_stmt, 6, trans(2));

        if (sqlite3_step(node_stmt) != SQLITE_DONE) {
            spdlog::error("Failed to insert node: {}", sqlite3_errmsg(db));
        }
        sqlite3_reset(node_stmt);
        sqlite3_clear_bindings(node_stmt);

        // Handle edges
        auto insert_edge = [&edge_stmt, &db](int id0, int id1, int type) {
            std::cout << "Inserting Edge: 0:" << id0 << " 1:" << id1 << " t:" << type << edge_stmt << std::endl;
            sqlite3_bind_int(edge_stmt, 1, id0);
            sqlite3_bind_int(edge_stmt, 2, id1);
            sqlite3_bind_int(edge_stmt, 3, type);
            if (sqlite3_step(edge_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert edge: {}", sqlite3_errmsg(db));
            }
            sqlite3_reset(edge_stmt);
            sqlite3_clear_bindings(edge_stmt);
        };

        std::cout << "Processing Keyframe: " << id << " ts: " << ts;

        // Spanning children
        for (const auto& child : keyfrm->graph_node_->get_spanning_children()) {
            if (!child || child->will_be_erased()) continue;
            insert_edge(id, child->id_, 0);
            insert_edge(child->id_, id, 0);
        }

        // Spanning parent
        auto parent = keyfrm->graph_node_->get_spanning_parent();
        if (parent) {
            insert_edge(id, parent->id_, 0);
            insert_edge(parent->id_, id, 0);
        }

        // Loop edges
        for (const auto& loop : keyfrm->graph_node_->get_loop_edges()) {
            if (!loop || loop->will_be_erased()) continue;
            insert_edge(id, loop->id_, 1);
            insert_edge(loop->id_, id, 1);
        }

        // Covisibility graph
        for (const auto& covis : keyfrm->graph_node_->get_covisibilities_over_min_num_shared_lms(50)) {
            if (!covis || covis->will_be_erased()) continue;
            insert_edge(id, covis->id_, -1);
            insert_edge(covis->id_, id, -1);
        }
    }

    sqlite3_finalize(node_stmt);
    sqlite3_finalize(edge_stmt);

    timestamp_groups_to_sqlite(db, map_db_path);
    user_defined_labels_to_sqlite(db, map_db_path);
    process_user_defined_labels_to_other_nodes(db);

    // Commit transaction
    ret = sqlite3_exec(db, "COMMIT", nullptr, nullptr, &err_msg);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to commit transaction: {}", err_msg);
        sqlite3_free(err_msg);
    }

    sqlite3_close(db);
}

int main(int argc, char* argv[]) {
#ifdef USE_STACK_TRACE_LOGGER
    backward::SignalHandling sh;
#endif

    // create options
    popl::OptionParser op("Allowed options");
    auto help = op.add<popl::Switch>("h", "help", "produce help message");
    auto vocab_file_path = op.add<popl::Value<std::string>>("v", "vocab", "vocabulary file path");
    auto log_level = op.add<popl::Value<std::string>>("", "log-level", "log level", "info");
    auto config_file_path = op.add<popl::Value<std::string>>("c", "config", "config file path");

    auto map_dir = op.add<popl::Value<std::string>>("m", "map_dir", "Map directory", "");
    auto map_db_path_in = op.add<popl::Value<std::string>>("i", "map-db-in", "load a map from this path");
    auto output_db_path = op.add<popl::Value<std::string>>("o", "map-db-out", "output SQLite database path", "slam.db");
   
    try {
        op.parse(argc, argv);
    }
    catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        std::cerr << std::endl;
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }

    // check validness of options
    if (help->is_set()) {
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }
    if (!op.unknown_options().empty()) {
        for (const auto& unknown_option : op.unknown_options()) {
            std::cerr << "unknown_options: " << unknown_option << std::endl;
        }
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }
    if (!vocab_file_path->is_set() || !config_file_path->is_set() || !map_db_path_in->is_set() || !output_db_path->is_set()) {
        std::cerr << "invalid arguments" << std::endl;
        std::cerr << std::endl;
        std::cerr << op << std::endl;
        return EXIT_FAILURE;
    }

    bool vocab_file_exists = fs::exists(vocab_file_path->value());
    bool config_file_exists = fs::exists(config_file_path->value());
    bool map_dir_exists = fs::exists(map_dir->value());

    if (!vocab_file_exists || !config_file_exists || ( map_dir->value().length() > 0 && !map_dir_exists) ) {
        std::cerr << "One of the provided directories doesn't exist: Vocab:" << vocab_file_exists << " Config:" << config_file_exists << " Map Directory:" << map_dir_exists << std::endl;
        std::cerr << "Vocab:" << vocab_file_path->value() << std::endl;
        std::cerr << "Config:" << config_file_path->value() << std::endl;
        std::cerr << "Map DB Dir" << map_dir->value() << std::endl;
        return EXIT_FAILURE;
    }


    // setup logger
    spdlog::set_pattern("[%Y-%m-%d %H:%M:%S.%e] %^[%L] %v%$");
    spdlog::set_level(spdlog::level::from_str(log_level->value()));

    // load configuration
    std::shared_ptr<stella_vslam::config> cfg;
    try {
        cfg = std::make_shared<stella_vslam::config>(config_file_path->value());
    }
    catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    std::string map_db_in = (fs::path(map_dir->value()) / fs::path(map_db_path_in->value())).string();
    std::string map_db_out = (fs::path(map_dir->value()) / fs::path(output_db_path->value())).string();

    if (!fs::exists(map_db_in)) {
        std::cerr << "map_db_in does not exist:" << map_db_in << std::endl;
        return EXIT_FAILURE;
    }

    // build a slam system
    auto slam = std::make_shared<stella_vslam::system>(cfg, vocab_file_path->value());
    bool need_initialize = true;
    // Load Map Database
    if (!map_db_in.empty()) {
        need_initialize = false;
        const auto path = fs::path(map_db_in);
        if (path.extension() == ".yaml") {
            YAML::Node node = YAML::LoadFile(path);
            for (const auto& map_path : node["maps"].as<std::vector<std::string>>()) {
                if (!slam->load_map_database(path.parent_path() / map_path)) {
                    return EXIT_FAILURE;
                }
            }
        }
        else {
            if (!slam->load_map_database(path)) {
                return EXIT_FAILURE;
            }
        }
    }
    slam->startup(need_initialize);
    slam->disable_mapping_module();

    convert_to_sqlite(slam, cfg, map_db_in, map_db_out);

    slam->shutdown();

    return 0;
}
