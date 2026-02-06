#include <iostream>
#include <string>
#include <boost/program_options.hpp>
#include <boost/filesystem.hpp>

namespace po = boost::program_options;
namespace fs = boost::filesystem;

fs::path path_to_stella = fs::path("Apps/SLAM/SitexplorerInterface/build/");
fs::path path_to_fbow = fs::path("Apps/SLAM/FBoW/orb_vocab.fbow");
fs::path path_to_config = fs::path("Apps/SLAM/Config/");

int main(int argc, char** argv) {
    po::options_description desc("Allowed options");
    desc.add_options()
        ("help,h", "produce help message")
        ("use_viewer", po::value<bool>()->default_value(true), "Use use_viewer (true|false)")
        ("use_temporal", "Enable temporal mapping")
        ("project_dir", po::value<std::string>()->required(), "Campus virtual project directory")
        ("view_static", "View without processing (optional)")
        ("convertToPg", "Convert SLAM map to Postgres DB (optional)")
        ("convertToSQLite", "Convert SLAM map to SQLite3 DB (optional)")
        ("in", po::value<std::string>(), "Input map (*.db) - Optional for normal mode")
        ("out", po::value<std::string>(), "Output map (*.db)")
        ("export_path", po::value<std::string>(), "Export path (*.db) for Sitexplorer DB")
        ("video_dir", po::value<std::string>(), "Media directory - videos")
        ("map_dir", po::value<std::string>(), "Map directory - maps") 
        ("videos", po::value<std::string>(), "Comma-separated ordered videos")
        ("json_dir", po::value<std::string>(), "JSON group-to-timestamp file directory")
        ("picture_dir", po::value<std::string>()->default_value("pictures/"), "Keyframe image output dir - Default 'pictures/'")
        ("config_file", po::value<std::string>()->default_value("default.yaml"), "Config file - Default 'default.yaml'")
        ("ts", po::value<std::string>(), "Start time of the Timestamps (Can use to make sure timestamps don't overlap)");

    po::positional_options_description pos_desc;
    pos_desc.add("use_viewer", 1);
    pos_desc.add("project_dir", 1);
    pos_desc.add("videos", 1);

    std::cout << "Processing args" << std::endl;

    po::variables_map vm;
    try {
        std::cout << "ARGS" << std::endl;
        for(int i=0;i<argc;i++) printf("(%i)%s ", i, argv[i]);
        std::cout << std::endl;

        po::store(po::command_line_parser(argc, argv).options(desc).positional(pos_desc).run(), vm);
        po::notify(vm);

        if (vm.count("help")) {
            std::cout << desc << std::endl;
            return 1;
        }

        // Check for required arguments based on mode
        bool view_statically = vm.count("view_static");
        bool convert_to_sqlite3 = vm.count("convertToSQLite");
        bool use_temporal_mapping = vm.count("use_temporal");

        if (!vm.count("project_dir")) {
            std::cout << "Missing required argument: project_dir" << std::endl;
            std::cout << desc << std::endl;
            return 1;
        }
        else if (convert_to_sqlite3) {
            std::cout << "Export to SQLite Mode" << std::endl;
            if (!vm.count("in") || !vm.count("export_path") || !vm.count("map_dir")) {
                std::cout << "For Sqlite3 conversion, required arguments: in, map_dir, export_path" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }
        else if (view_statically) {
            std::cout << "Static View Mode" << std::endl;
            if (!vm.count("in") || !vm.count("map_dir")) {
                std::cout << "For static viewing, required arguments: in, map_dir" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }
        else {
            std::cout << "Mapping Mode" << std::endl;
            if (!vm.count("videos") || !vm.count("out") || !vm.count("video_dir") || !vm.count("map_dir")) {
                std::cout << "For normal mode, required arguments: use_viewer, root dir, videos, in, out, media_dir, map_dir, (optional: json_dir, picture_dir, config_file, ts, use_temporal)" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }

        std::cout << "Loading Args" << std::endl;
        bool use_viewer = vm["use_viewer"].as<bool>();

        std::string ts_start = vm.count("ts") ? vm["ts"].as<std::string>() : "";
        fs::path project_dir = fs::path(vm["project_dir"].as<std::string>());
        fs::path map_in = vm.count("in") ? vm["in"].as<std::string>() : "";
        fs::path map_out = vm.count("out") ? vm["out"].as<std::string>() : "";
        fs::path media_dir = vm.count("video_dir") ? vm["video_dir"].as<std::string>() : "";
        fs::path map_dir = fs::path(vm["map_dir"].as<std::string>());
        std::string videos = vm.count("videos") ? vm["videos"].as<std::string>() : "";
        fs::path json_dir = vm.count("json_dir") ? vm["json_dir"].as<std::string>() : "";
        fs::path picture_dir = fs::path(vm["picture_dir"].as<std::string>());
        fs::path config_file = vm["config_file"].as<std::string>();
        fs::path export_path = vm.count("export_path") ? vm["export_path"].as<std::string>() : "";

        std::string command;
        if (convert_to_sqlite3) {
            std::cout << "Convert to SQLite" << std::endl;
            command = "sx_slam_to_sqlite -c '" + (project_dir / path_to_config / config_file).string() + "'" +
                              " -v '" + (project_dir / path_to_fbow).string() + "'" +
                              " -i '" + (map_dir / map_in).string() + "'" +
                              " -o '" + (export_path).string() + "'";
        }
        else if (view_statically){
            std::cout << "Viewing" << std::endl;
            command = "sx_view_map -c '" + (project_dir / path_to_config / config_file).string() + "'" +
                        " -v '" + (project_dir / path_to_fbow).string() + "'" +
                        (map_in.empty() ? "" : " -i '" + (map_dir / map_in).string() + "'") +
                        " -o '" +  (map_dir / map_out).string() + "'";
        }
        else {
            std::cout << "Mapping" << std::endl;
            command = "sx_map -c '" + (project_dir / path_to_config / config_file).string() + "'" +
                                        " -v '" + ( project_dir / path_to_fbow).string() + "'" +
                                        (ts_start.size() > 0 ? " -t '" + ts_start + "'" : "" ) +
                                        (map_in.empty() ? "" : " --map-db-in '" + (map_dir / map_in).string() + "'") +
                                        " --map-db-out '" +  (map_dir / map_out).string() + "'" +
                                        " --videos '" + videos + "'" +
                                        " --no-sleep " + // Operate faster than real time
                                        " --video-dir '" +  (media_dir).string() + "/" + "'" +
                                        " --json-dir '" + (json_dir).string() + "/" + "'" // Only required for 'pairing JSON with frames' step
                                        " --picture-dir '" + (picture_dir).string() + "/" + "'" +
                                        " --log-level debug" +
                                        " --frame-skip 3" +
                                        (use_temporal_mapping ? " --temporal-mapping" : "") +
                                        (use_viewer ? " --viewer none" : " --viewer iridescence_viewer");
        }
        
        std::cout << "Command: " << command << std::endl;
        int32_t ret_val = system(command.c_str());
        return ret_val;
    } catch (po::too_many_positional_options_error &e) {
    // A positional argument like `opt2=option_value_2` was given
    std::cerr << e.what() << std::endl;
    exit(1);
    } catch (po::error_with_option_name &e) {
    // Another usage error occurred
    std::cerr << e.what() << std::endl;
    exit(1);
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        exit(1);
    }

    return 0;
}
