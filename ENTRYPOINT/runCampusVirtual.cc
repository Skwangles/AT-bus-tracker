#include <iostream>
#include <string>
#include <boost/program_options.hpp>

std::string path_to_stella = "Apps/SLAM/CampusVirtualInterface/build/";
std::string path_to_fbow = "Apps/SLAM/FBoW/orb_vocab.fbow";
std::string path_to_config = "Config/";

namespace po = boost::program_options;

int main(int argc, char** argv) {
    po::options_description desc("Allowed options");
    desc.add_options()
        ("help,h", "produce help message")
        ("use_viewer", po::value<bool>()->default_value(true), "Use use_viewer (true|false)")
        ("project_dir", po::value<std::string>()->required(), "Campus virtual project directory")
        ("view_static", "View without processing (optional)")
        ("convertToPg", "Convert to Postgres (optional)")
        ("in", po::value<std::string>(), "Input map (*.db)")
        ("out", po::value<std::string>(), "Output map (*.db)")
        ("media_dir", po::value<std::string>(), "Media directory - videos")
        ("map_dir", po::value<std::string>(), "Map directory - maps") 
        ("videos", po::value<std::string>(), "Comma-separated ordered videos")
        ("json_dir", po::value<std::string>(), "JSON group-to-timestamp file directory")
        ("picture-dir", po::value<std::string>()->default_value("pictures/"), "Keyframe image output dir - Default 'pictures/'")
        ("config_file", po::value<std::string>()->default_value("equirectangular.yaml"), "Config file - Default 'equirectangular.yaml'")
        ("db_user", po::value<std::string>()->default_value("campusvirtual"), "Database username")
        ("db_pwd", po::value<std::string>()->default_value("Squeegee-Grandkid-Superhero8"), "Database password")
        ("db_name", po::value<std::string>()->default_value("cv"), "Database name")
        ("db_port", po::value<std::string>()->default_value("5432"), "Database port");

    po::positional_options_description pos_desc;
    pos_desc.add("use_viewer", 1);
    pos_desc.add("project_dir", 1);
    pos_desc.add("videos", 1);

    po::variables_map vm;
    try {
        po::store(po::command_line_parser(argc, argv).options(desc).positional(pos_desc).run(), vm);
        po::notify(vm);

        if (vm.count("help")) {
            std::cout << desc << std::endl;
            return 1;
        }

        // Check for required arguments based on mode
        bool view_statically = vm.count("view_static");
        bool convert_to_pg = vm.count("convertToPg");

        if (!vm.count("project_dir")) {
            std::cout << "Missing required argument: project_dir" << std::endl;
            std::cout << desc << std::endl;
            return 1;
        }

        if (convert_to_pg) {
            if (!vm.count("in") || !vm.count("map_dir")) {
                std::cout << "For Postgres conversion, required arguments: in, map_dir" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }
        else if (view_statically) {
            if (!vm.count("in") || !vm.count("map_dir")) {
                std::cout << "For static viewing, required arguments: in, map_dir" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }
        else {
            if (!vm.count("videos") || !vm.count("in") || !vm.count("out") || !vm.count("media_dir") || !vm.count("map_dir")) {
                std::cout << "For normal mode, required arguments: videos, in, out, media_dir, map_dir, (optional: json_dir, picture-dir, config_file)" << std::endl;
                std::cout << desc << std::endl;
                return 1;
            }
        }

        bool use_viewer = vm["use_viewer"].as<bool>();
        std::string project_dir = vm["project_dir"].as<std::string>();
        std::string map_in = vm.count("in") ? vm["in"].as<std::string>() : "";
        std::string map_out = vm.count("out") ? vm["out"].as<std::string>() : "";
        std::string media_dir = vm.count("media_dir") ? vm["media_dir"].as<std::string>() : "";
        std::string map_dir = vm["map_dir"].as<std::string>();
        std::string videos = vm.count("videos") ? vm["videos"].as<std::string>() : "";
        std::string json_dir = vm.count("json_dir") ? vm["json_dir"].as<std::string>() : "";
        std::string picture_dir = vm["picture-dir"].as<std::string>();
        std::string db_user = vm["db_user"].as<std::string>();
        std::string db_pwd = vm["db_pwd"].as<std::string>();
        std::string db_name = vm["db_name"].as<std::string>();
        std::string db_port = vm["db_port"].as<std::string>();
        std::string config_file = vm["config_file"].as<std::string>();

        std::string command;
        if (convert_to_pg){
            std::string connection_string = "postgresql://" + db_user + ":" + db_pwd + "@localhost:" + db_port + "/" + db_name;
            command = project_dir + path_to_stella + "slam_to_pg" +
                              " -c " + project_dir + path_to_config  + config_file +
                              " -v " + project_dir + path_to_fbow +
                              " --map-db-in " + map_dir + "/" + map_in +
                              " --db " + connection_string;
        }
        else if (view_statically){
            command = project_dir + path_to_stella + "campus_virtual_viewer" +
                              " -c " + project_dir + path_to_config + config_file+
                              " -v " + project_dir + path_to_fbow +
                              (map_in.empty() ? "" : " --map-db-in " + map_dir + "/" + map_in) +
                              " --map-db-out " +  map_dir + "/" + map_out;
        }
        else {
            command = project_dir + path_to_stella + "campus_virtual" +
                                        " -c " + project_dir + path_to_config + config_file +
                                        " -v " + project_dir + path_to_fbow +
                                        (map_in.empty() ? "" : " --map-db-in " + map_dir + "/" + map_in) +
                                        " --map-db-out " +  map_dir + "/" + map_out +
                                        " --videos " + videos +
                                        " --no-sleep " + // Operate faster than real time
                                        " --video-dir " +  media_dir + "/" +
                                        " --json-dir " + json_dir + "/" + // Only required for 'pairing JSON with frames' step
                                        " --picture-dir " + picture_dir + "/" +
                                       (use_viewer ? " --viewer none" : " --viewer iridescence_viewer");
        }
        
        std::cout << "Command: " << command << std::endl;
        system(command.c_str());

    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
