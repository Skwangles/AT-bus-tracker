#include "campus_virtual_socket_publisher/publisher.h"

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

#include <sqlite3.h>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

// Function to create necessary tables in SQLite
void create_tables_if_not_exist(sqlite3* db) {
    char* err_msg = nullptr;
    
    const char* sql = R"(
        DROP TABLE IF EXISTS nodes;
        DROP TABLE IF EXISTS edges;
        DROP TABLE IF EXISTS node_locations;

        CREATE TABLE nodes (
            ts REAL NOT NULL,
            keyframe_id INTEGER PRIMARY KEY,
            pose BLOB NOT NULL,
            x_trans REAL,
            y_trans REAL,
            z_trans REAL,
            label TEXT DEFAULT NULL
        );

        CREATE TABLE edges (
            keyframe_id0 INTEGER NOT NULL,
            keyframe_id1 INTEGER NOT NULL,
            type INTEGER DEFAULT 2,
            FOREIGN KEY (keyframe_id0) REFERENCES nodes(keyframe_id),
            FOREIGN KEY (keyframe_id1) REFERENCES nodes(keyframe_id),
            UNIQUE(keyframe_id0, keyframe_id1),
            PRIMARY KEY (keyframe_id0, keyframe_id1)
        );

        CREATE TABLE node_locations (
            keyframe_id INTEGER PRIMARY KEY NOT NULL,
            location TEXT,
            FOREIGN KEY (keyframe_id) REFERENCES nodes(keyframe_id)
        );
    )";

    int rc = sqlite3_exec(db, sql, nullptr, nullptr, &err_msg);
    if (rc != SQLITE_OK) {
        spdlog::error("SQL error: {}", err_msg);
        sqlite3_free(err_msg);
    }
}

void timestamp_groups_to_sqlite(sqlite3* db, const std::string& map_db_path) {
    sqlite3* source_db = nullptr;
    int ret = sqlite3_open(map_db_path.c_str(), &source_db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open source SQL database");
        return;
    }

    auto node_locations = load_timestamp_groups(source_db);

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

    for (const timestamp_group& node_loc : node_locations) {
        sqlite3_bind_double(stmt, 1, node_loc.timestamp);
        
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            int id = sqlite3_column_int(stmt, 0);
            std::cout << "Paired ts " << node_loc.timestamp << " with keyframe_id " << id << std::endl;
            
            sqlite3_bind_int(insert_stmt, 1, id);
            sqlite3_bind_text(insert_stmt, 2, node_loc.group.c_str(), -1, SQLITE_STATIC);
            
            if (sqlite3_step(insert_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert node location: {}", sqlite3_errmsg(db));
            }
            
            sqlite3_reset(insert_stmt);
            sqlite3_clear_bindings(insert_stmt);
        } else {
            std::cout << "Could not find a timestamp match for " << node_loc.timestamp << " of group " << node_loc.group << std::endl;
        }
        
        sqlite3_reset(stmt);
        sqlite3_clear_bindings(stmt);
    }

    sqlite3_finalize(stmt);
    sqlite3_finalize(insert_stmt);
    sqlite3_close(source_db);
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
    
    create_tables_if_not_exist(db);

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
            sqlite3_bind_int(edge_stmt, 1, id0);
            sqlite3_bind_int(edge_stmt, 2, id1);
            sqlite3_bind_int(edge_stmt, 3, type);
            if (sqlite3_step(edge_stmt) != SQLITE_DONE) {
                spdlog::error("Failed to insert edge: {}", sqlite3_errmsg(db));
            }
            sqlite3_reset(edge_stmt);
            sqlite3_clear_bindings(edge_stmt);
        };

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

    auto map_db_path_in = op.add<popl::Value<std::string>>("i", "map-db-in", "load a map from this path", "");
    auto output_db_path = op.add<popl::Value<std::string>>("o", "output-db", "output SQLite database path", "slam.db");
   
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
    if (!vocab_file_path->is_set() || !config_file_path->is_set()) {
        std::cerr << "invalid arguments" << std::endl;
        std::cerr << std::endl;
        std::cerr << op << std::endl;
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

    std::string map_db_in = map_db_path_in->value();

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

    convert_to_sqlite(slam, cfg, map_db_path_in->value(), output_db_path->value());

    slam->shutdown();

    return 0;
}
