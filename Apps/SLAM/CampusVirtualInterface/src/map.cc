#ifdef HAVE_PANGOLIN_VIEWER
#include "pangolin_viewer/viewer.h"
#endif
#ifdef HAVE_IRIDESCENCE_VIEWER
#include "iridescence_viewer/viewer.h"
#endif

#include "stella_vslam/system.h"
#include "stella_vslam/config.h"
#include "stella_vslam/camera/base.h"
#include "stella_vslam/util/yaml.h"
#include "stella_vslam/util/string.h"
#include "stella_vslam/publish/map_publisher.h"

#include <iostream>
#include <chrono>
#include <fstream>
#include <numeric>
#include <iomanip>
#include <sstream>

#include <opencv2/core/mat.hpp>
#include <opencv2/core/types.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/videoio.hpp>
#include <spdlog/spdlog.h>
#include <popl.hpp>
#include <nlohmann/json.hpp>

#include <ghc/filesystem.hpp>
namespace fs = ghc::filesystem;

#include "util/save_to_db.hpp"
#include "util/handle_json.hpp"
#include "util/yaml.h"
#include "util/frame_writing.hpp"

#ifdef USE_STACK_TRACE_LOGGER
#include <backward.hpp>
#endif

#ifdef USE_GOOGLE_PERFTOOLS
#include <gperftools/profiler.h>
#endif

#define USE_SQLITE3 true
#define IMWRITE_THREAD_POOL_SIZE 4

static int db_callback(std::vector<video_timestamp> *data, int argc, char **argv, char **azColName){
   data->push_back(video_timestamp(argv[0], std::atof(argv[1]), std::atof(argv[2])));
   return 0;
}

const std::string DEFAULT_UNKNOWN_GROUP = "Unknown";


int mono_tracking(const std::shared_ptr<stella_vslam::system>& slam,
                  const std::shared_ptr<stella_vslam::config>& cfg,
                  const std::string& video_file_path,
                  const std::string& mask_img_path,
                  const unsigned int frame_skip,
                  const unsigned int start_time,
                  const bool no_sleep,
                  const bool wait_loop_ba,
                  const bool auto_term,
                  const std::string& eval_log_dir,
                  const std::string& map_db_path,
                  const double start_timestamp,
                  const int ts_dp,
                  const std::string& viewer_string,
                  nlohmann::json& json_obj,
                  std::vector<timestamp_annotation>& timestamp_group_list,
                  std::vector<timestamp_annotation>& special_point_group_list,
                  const bool exit_on_imwrite_fail,
                  const std::string& image_output_dir = "pictures/",
                  const unsigned int slam_img_width = 1920,
                  const unsigned int slam_img_height = 960
                  ) {
    // load the mask image
    const cv::Mat mask = mask_img_path.empty() ? cv::Mat{} : cv::imread(mask_img_path, cv::IMREAD_GRAYSCALE);
    
    std::mutex mtx_imwrite_failed;
    bool imwrite_failed = false;


    bool manual_loop_detect_pause = false;


    // create a viewer object
    // and pass the frame_publisher and the map_publishe
    std::mutex mtx_pause;
    std::mutex mtx_loop_detect_pause;
    bool is_paused = false;
    bool is_loop_detect_paused = false;
#ifdef HAVE_IRIDESCENCE_VIEWER
    std::shared_ptr<iridescence_viewer::viewer> iridescence_viewer;

    std::mutex mtx_loop;
    bool loop_id = 0;

    std::mutex mtx_terminate;
    bool terminate_is_requested = false;
    std::mutex mtx_step;
    unsigned int step_count = 0;
    if (viewer_string == "iridescence_viewer") {
        iridescence_viewer = std::make_shared<iridescence_viewer::viewer>(
            stella_vslam::util::yaml_optional_ref(cfg->yaml_node_, "IridescenceViewer"),
            slam->get_frame_publisher(),
            slam->get_map_publisher());
        iridescence_viewer->add_checkbox("Pause Loop Detection", [&is_loop_detect_paused, &mtx_loop_detect_pause, &slam](bool check) {
            std::lock_guard<std::mutex> lock(mtx_loop_detect_pause);
            if (is_loop_detect_paused != check)
            {
                if (check){
                    slam->disable_loop_detector();
                }
                else {
                    slam->enable_loop_detector();
                }

            }

            is_loop_detect_paused = check;
        });
        iridescence_viewer->add_button("Step", [&step_count, &mtx_step] {
            std::lock_guard<std::mutex> lock(mtx_step);
            step_count++;
        });
        iridescence_viewer->add_button("Reset", [&is_paused, &mtx_pause, &slam] {
            slam->request_reset();
        });

        iridescence_viewer->add_button("Save and exit", [&is_paused, &mtx_pause, &terminate_is_requested, &mtx_terminate, &slam, &iridescence_viewer] {
            std::lock_guard<std::mutex> lock1(mtx_pause);
            is_paused = false;
            std::lock_guard<std::mutex> lock2(mtx_terminate);
            terminate_is_requested = true;
            iridescence_viewer->request_terminate();
        });
        iridescence_viewer->add_close_callback([&is_paused, &mtx_pause, &terminate_is_requested, &mtx_terminate] {
            std::lock_guard<std::mutex> lock1(mtx_pause);
            is_paused = false;
            std::lock_guard<std::mutex> lock2(mtx_terminate);
            terminate_is_requested = true;
        });
    }
#endif

    

    // 1. Get first frame
    auto video = cv::VideoCapture(video_file_path, cv::CAP_FFMPEG);
    if (!video.isOpened()) {
        std::cerr << "Unable to open the video: " << video_file_path << std::endl;
        return EXIT_FAILURE;
    }
    video.set(0, start_time);

    std::vector<double> track_times;

    unsigned int num_frame = 0;
    double timestamp = start_timestamp;

    int32_t last_assigned_special_point_idx = 0;
    
    std::vector<std::string> special_points;    
    
    int32_t last_loop_detection_disable_idx = 0; 
    double next_loop_disable_check = -1;

    ThreadPool img_write_thread_pool(IMWRITE_THREAD_POOL_SIZE);
    
    // run the slam in another thread
    std::thread thread([&]() {
        
        bool is_not_end = true;
        cv::Mat frame;
        cv::Mat downsized_frame;
        
        // 2. Start by saving every frame until we are told keyframes are being made
        bool finished_initialising_tracking = false;
        while (is_not_end) {

            // 3. Pause to complete any other tasks before continuing
#ifdef HAVE_IRIDESCENCE_VIEWER
            while (true) {
                {
                    std::lock_guard<std::mutex> lock(mtx_pause);
                    if (!is_paused) {
                        break;
                    }
                }
                {
                    std::lock_guard<std::mutex> lock(mtx_step);
                    if (step_count > 0) {
                        step_count--;
                        break;
                    }
                }
                std::this_thread::sleep_for(std::chrono::microseconds(5000));
            }
#endif
            {
                std::lock_guard<std::mutex> lock(mtx_imwrite_failed);
                if (!exit_on_imwrite_fail && imwrite_failed) {
                    spdlog::error("Failed to write keyframe image, exiting... (to continue regardless use --no-exit-imwrite-fail)");
                    return EXIT_FAILURE;
                }
            } 

            // wait until the loop BA is finished
            if (wait_loop_ba) {
                while (slam->loop_BA_is_running() || !slam->mapping_module_is_enabled()) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(100));
                }
            }

            // 4. Get next frame and metadata about it 
            is_not_end = video.read(frame);

            double ms_since_start = video.get(cv::CAP_PROP_POS_MSEC);
            double frame_count = video.get(cv::CAP_PROP_FRAME_COUNT);
            double fps = video.get(cv::CAP_PROP_FPS);

            double sec_since_start = ms_since_start/1000;
            
            if (ms_since_start > 0)
            {
                timestamp = start_timestamp + sec_since_start;
            }
            
            // 5. Disable/enable loop detector from JSON timecodes 
            // Some points during filming may need the loop detection disabled to prevent false overlaps
            if (manual_loop_detect_pause != -1 &&  sec_since_start > next_loop_disable_check) {
                auto next_check = get_loop_detector_status_from_json(json_obj, ms_since_start);
                manual_loop_detect_pause = next_check.first;
                next_loop_disable_check = next_check.second;
            }
            
            // Disable loop detect based on timecode, but don't enable if the 'pause loop detector checkbox' is still ticked
            if (slam->loop_detector_is_enabled() ==  manual_loop_detect_pause) {
                if (manual_loop_detect_pause){
                    slam->disable_loop_detector();
                }
                else if (!is_loop_detect_paused) {
                    slam->enable_loop_detector();
                }
            }
            

            const auto tp_1 = std::chrono::steady_clock::now();

            if (!frame.empty() && (num_frame % frame_skip == 0)) {
                // 6. Feed to SLAM the frame rescaled to a more performant resolution, while keeping high quality for image export
                cv::resize(frame, downsized_frame, cv::Size(slam_img_width, slam_img_height));
		        bool is_keyframe = slam->feed_monocular_frame_bool(downsized_frame, timestamp, mask);
                
                

                if (!image_output_dir.empty()) {
                    // Save image to work on front end
                    std::stringstream stream;
                    stream << std::fixed << std::setprecision(ts_dp) << timestamp; // Sqlite3 REAL datatype seems only accurate to 5dp, so use 5dp for identifier
                    std::string timestamp_string = stream.str();              
                 
                    std::string filepath = image_output_dir + timestamp_string + ".png";

                    if (is_keyframe && !finished_initialising_tracking) {
                    // `is_keyframe` will not be true until the tracking has initialised, however, keyframes may still be made.
                    // Once it becomes true once, that indicates it has been initialised
                        finished_initialising_tracking = true;
                    }

                    // 7. Save keyframe image and determine its location and any special point information (e.g. this point represents an elevator)
                    if (is_keyframe || !finished_initialising_tracking){
                        
                        std::vector<int> params; 
                        params.push_back(cv::IMWRITE_JPEG_QUALITY); 
                        params.push_back(100); // 0-100 - 100 = highest quality

                        img_write_thread_pool.enqueue([ms_since_start, timestamp, by_copy_frame = frame.clone(), filepath, params, &imwrite_failed, &mtx_imwrite_failed]() {
                            // Do writing in background
                            bool result = cv::imwrite(filepath, by_copy_frame, params);
                            if (!result){
                                std::lock_guard<std::mutex> lock(mtx_imwrite_failed);
                                imwrite_failed = true;
                            }   
                            }
                        );
                        
                        
                        spdlog::debug("Keyframe - Progress: {}% - ms: {}", ((ms_since_start/1000) / (frame_count/fps)) * 100, ms_since_start); 
                        if (json_obj != NULL){
                            
                            std::string group = find_group_from_json(json_obj, ms_since_start);
                            timestamp_group_list.emplace_back(group, timestamp, ms_since_start);
                            
                            
                            last_assigned_special_point_idx = get_special_points(json_obj, ms_since_start, last_assigned_special_point_idx, special_points);
                            for (auto annotation : special_points){
                                special_point_group_list.emplace_back(annotation, timestamp, ms_since_start);
                            }
                            
                            
                            spdlog::debug("Keyframe Location: {}", group); 
                        }
                        else{
                            timestamp_group_list.emplace_back(DEFAULT_UNKNOWN_GROUP, timestamp, ms_since_start);
                            spdlog::error("JSON Obj was null! - Using default:" + DEFAULT_UNKNOWN_GROUP);
                        }
                        
                    }
                }
            }

            const auto tp_2 = std::chrono::steady_clock::now();

            const auto track_time = std::chrono::duration_cast<std::chrono::duration<double>>(tp_2 - tp_1).count();
            if (num_frame % frame_skip == 0) {
                track_times.push_back(track_time);
            }

            // 8. Wait until the timestamp of the next frame - if waiting for realtime
            if (!no_sleep) {
                const auto wait_time = 1.0 / slam->get_camera()->fps_ - track_time;
                if (0.0 < wait_time) {
                    std::this_thread::sleep_for(std::chrono::microseconds(static_cast<unsigned int>(wait_time * 1e6)));
                }
            }
            
            ++num_frame;

            // 9. Check exit conditions
#ifdef HAVE_IRIDESCENCE_VIEWER
            // check if the termination of slam system is requested or not
            {
                std::lock_guard<std::mutex> lock(mtx_terminate);
                if (terminate_is_requested) {
                    break;
                }
            }
#else
            // check if the termination of slam system is requested or not
            if (slam->terminate_is_requested()) {
                break;
            }
#endif
            if (num_frame > 1 && ms_since_start == 0) {
                if (is_not_end){
                    spdlog::error("OpenCV thinks video is not ended, when MSEC is 0");
                }
                break; // MSec will be 0 when the video ends
            }
        }

        // wait until the loop BA is finished
        while (slam->loop_BA_is_running()) {
            std::this_thread::sleep_for(std::chrono::microseconds(5000));
        }

        // automatically close the viewer
        if (auto_term) 
        {
            if (viewer_string == "iridescence_viewer") {
#ifdef HAVE_IRIDESCENCE_VIEWER
                iridescence_viewer->request_terminate();
#endif
            }
        }

        return 0;
    });

    // run the viewer in the current thread
    if (viewer_string == "iridescence_viewer") {
#ifdef HAVE_IRIDESCENCE_VIEWER
        iridescence_viewer->run();
#endif
    }

    thread.join();

    // shutdown the slam process
    slam->shutdown();

    if (!eval_log_dir.empty()) {
        // output the trajectories for evaluation
        slam->save_frame_trajectory(eval_log_dir + "/frame_trajectory.txt", "TUM");
        slam->save_keyframe_trajectory(eval_log_dir + "/keyframe_trajectory.txt", "TUM");
        // output the tracking times for evaluation
        std::ofstream ofs(eval_log_dir + "/track_times.txt", std::ios::out);
        if (ofs.is_open()) {
            for (const auto track_time : track_times) {
                ofs << track_time << std::endl;
            }
            ofs.close();
        }
    }

    std::sort(track_times.begin(), track_times.end());
    const auto total_track_time = std::accumulate(track_times.begin(), track_times.end(), 0.0);
    spdlog::info("Tracking time: min={}s, max={}s, median={}s, mean={}s",
                 track_times.front(), track_times.back(), track_times.at(track_times.size() / 2), total_track_time / track_times.size());

    if (!map_db_path.empty()) {
        if (!slam->save_map_database(map_db_path)) {
            return EXIT_FAILURE;
        }
    }

    if (!img_write_thread_pool.is_tasks_done()) {
        while (!img_write_thread_pool.is_tasks_done()) {
            spdlog::info("Waiting on {} images to be written", img_write_thread_pool.get_num_tasks_left());
            std::this_thread::sleep_for(chrono::milliseconds(1000));
        }
    }
    spdlog::info("All images are written: {} images left", img_write_thread_pool.get_num_tasks_left());

    return timestamp;
}

int main(int argc, char* argv[]) {
    int ret;
    sqlite3* db = nullptr;
#ifdef USE_STACK_TRACE_LOGGER
    backward::SignalHandling sh;
#endif

    // create options
    popl::OptionParser op("Allowed options");
    auto help = op.add<popl::Switch>("h", "help", "produce help message");
    auto vocab_file_path = op.add<popl::Value<std::string>>("v", "vocab", "vocabulary file path");
   
    auto config_file_path = op.add<popl::Value<std::string>>("c", "config", "config file path");
    auto mask_img_path = op.add<popl::Value<std::string>>("", "mask", "mask image path", "");
    auto frame_skip = op.add<popl::Value<unsigned int>>("", "frame-skip", "interval of frame skip", 1);
    auto start_time = op.add<popl::Value<unsigned int>>("s", "start-time", "time to start playing [milli seconds]", 0);
    auto no_sleep = op.add<popl::Switch>("", "no-sleep", "not wait for next frame in real time");
    auto wait_loop_ba = op.add<popl::Switch>("", "wait-loop-ba", "wait until the loop BA is finished");
    auto exit_if_imwrite_fails = op.add<popl::Switch>("", "no-exit-imwrite-fail", "Do not terminate if cv::imwrite fails");
    auto log_level = op.add<popl::Value<std::string>>("", "log-level", "log level", "info");
    auto eval_log_dir = op.add<popl::Value<std::string>>("", "eval-log-dir", "store trajectory and tracking times at this path (Specify the directory where it exists.)", "");
    auto map_db_path_in = op.add<popl::Value<std::string>>("i", "map-db-in", "load a map from this path", "");
    auto map_db_path_out = op.add<popl::Value<std::string>>("o", "map-db-out", "store a map database at this path after slam", "");
    auto disable_mapping = op.add<popl::Switch>("", "disable-mapping", "disable mapping");
    auto temporal_mapping = op.add<popl::Switch>("", "temporal-mapping", "enable temporal mapping");
    auto start_timestamp = op.add<popl::Value<double>>("t", "start-timestamp", "timestamp of the start of the very first video (e.g. unique timestamp where the last video ended)");
    auto viewer = op.add<popl::Value<std::string>>("", "viewer", "viewer [iridescence_viewer, pangolin_viewer, socket_publisher, none]");
    auto json_dir = op.add<popl::Value<std::string>>("", "json-dir", "directory containing json files for timestamp-to-group calculations");
    auto videos = op.add<popl::Value<std::string>>("", "videos", "set of comma separated videos files to process (e.g. g-block.mp4,g-block2.mp4)");
    auto video_dir = op.add<popl::Value<std::string>>("", "video-dir", "directory containing video files, if not set must be part of the videos option");
    auto img_output_dir = op.add<popl::Value<std::string>>("p", "picture-dir", "Directory to put keyframe img snapshots in", "pictures/");
    auto ts_dp = op.add<popl::Value<unsigned int>>("", "ts-dp", "Decimal places of Keyframe Image names derived from keyframe timestamp (ts) - Default: 5, e.g. 5dp -> `0.12345.png`", 5);
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

    // Check directories exist
    if (!fs::exists(vocab_file_path->value()) || !fs::exists(config_file_path->value()) ){
        std::cerr << "Vocab filepath or config file path do not exist" << std::endl;
        return EXIT_FAILURE;
    }

    // viewer
    std::string viewer_string;
    if (viewer->is_set()) {
        viewer_string = viewer->value();
        if (viewer_string != "iridescence_viewer"
            && viewer_string != "none") {
            std::cerr << "invalid arguments (--viewer)" << std::endl
                      << std::endl
                      << op << std::endl;
            return EXIT_FAILURE;
        }

#ifndef HAVE_IRIDESCENCE_VIEWER
        if (viewer_string == "iridescence_viewer") {
            std::cerr << "iridescence_viewer not linked" << std::endl
                      << std::endl
                      << op << std::endl;
            return EXIT_FAILURE;
        }
#endif
    }
    else {
#ifdef HAVE_IRIDESCENCE_VIEWER
        viewer_string = "iridescence_viewer";
#endif
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

#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStart("slam.prof");
#endif

    ///
    /// If "IN" db is provided, copy the previous entries before they are overwritten
    ///
    std::string map_db_in = map_db_path_in->value();
    std::vector<timestamp_annotation> timestamp_group_list;
    std::vector<timestamp_annotation> special_point_group_list;

    if (map_db_path_in->is_set()){
        if (!fs::exists(map_db_in)){
            std::cerr << "Map DB path in does not exist: " << map_db_in << std::endl;
            return EXIT_FAILURE;
        }

        db = nullptr;
        ret = sqlite3_open(map_db_in.c_str(), &db);
        if (ret != SQLITE_OK) {
            spdlog::error("Failed to open SQL database");
            return EXIT_FAILURE;
        }

        load_timestamp_groups(db, timestamp_group_list);
        load_special_point_timestamps(db, special_point_group_list);

        sqlite3_close(db);
    }
    auto map_path_out = fs::path(map_db_path_out->value());
    if (!fs::exists(map_path_out.remove_filename().string())){
        std::cerr << "Map DB out doesn't exist: " << map_path_out.remove_filename().string() << std::endl;
        return EXIT_FAILURE; 
    }

    std::string video_file_path;

    // You cannot get timestamps of images with this input format.
    // It is recommended to specify the timestamp when the video recording was started in Unix time.
    // If not specified, the current system time is used instead.

    double timestamp = 0.0;
    if (!start_timestamp->is_set()) {
            std::cerr << "--start-timestamp is not set. using system timestamp." << std::endl;
            if (no_sleep->is_set()) {
                std::cerr << "If --no-sleep is set without --start-timestamp, timestamps may overlap between multiple runs." << std::endl;
            }
            std::chrono::system_clock::time_point start_time_system = std::chrono::system_clock::now();
            timestamp = std::chrono::duration_cast<std::chrono::duration<double>>(start_time_system.time_since_epoch()).count();
        }
    else {
            timestamp = start_timestamp->value();
    } 



    for (const auto& video_file : stella_vslam::util::split_string(videos->value(), ',')) {
        if (video_dir->is_set()) {

             video_file_path = fs::path(video_dir->value()).string() + "/" + video_file;
        }
        else {
            video_file_path = video_file;
        }

        if (!fs::exists(video_file_path)){
            std::cerr << "Video dir does not exist: " << video_file_path << std::endl;
            return EXIT_FAILURE; 
        }

        spdlog::info("Processing video: {}", video_file_path);

        nlohmann::json json_obj;
        if (json_dir->is_set()){
            if (!fs::exists(json_dir->value())){
                std::cerr << "Json Dir does not exist: " << json_dir->value() << std::endl;
                return EXIT_FAILURE;
            }

            const auto vid_path = fs::path(video_file_path);
            const auto video_name = vid_path.stem().string() + ".json";

            json_obj = filename_to_json_obj(video_name, json_dir->value());

            if (json_obj != NULL){
                spdlog::debug("JSON Object Contents: {}", json_obj.dump(4));
            }
            else{
                spdlog::error("Failed to open JSON file {}", video_name);
            }
        }


        // build a slam system
        auto slam = std::make_shared<stella_vslam::system>(cfg, vocab_file_path->value());
        bool need_initialize = true;
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
        if (disable_mapping->is_set()) {
            slam->disable_mapping_module();
        }
        else if (temporal_mapping->is_set()) {
            slam->enable_temporal_mapping();
            slam->disable_loop_detector();
        }

        auto img_size = yaml_optional_ref(cfg->yaml_node_, "Camera");

        // run tracking
        double finish_timestamp = 0.0;
        if (slam->get_camera()->setup_type_ == stella_vslam::camera::setup_type_t::Monocular) {
            finish_timestamp = mono_tracking(slam,
                                cfg,
                                video_file_path,
                                mask_img_path->value(),
                                frame_skip->value(),
                                start_time->value(),
                                no_sleep->is_set(),
                                wait_loop_ba->is_set(),
                                true /* Video loop should always autoterm*/,
                                eval_log_dir->value(),
                                map_db_path_out->value(),
                                timestamp,
                                ts_dp->value(),
                                viewer_string, 
                                json_obj, 
                                timestamp_group_list,
                                special_point_group_list,
                                exit_if_imwrite_fails->is_set(),
                                img_output_dir->value(),
                                img_size["cols"].as<unsigned int>(),
                                img_size["rows"].as<unsigned int>()
                                );
        }
        else {
            throw std::runtime_error("Invalid setup type: " + slam->get_camera()->get_setup_type_string());
        }
        spdlog::info("Finish Timestamp: {}", finish_timestamp);
        
        timestamp = finish_timestamp + 1;
        spdlog::info("Next video will start at timestamp: {}", timestamp);
        spdlog::info("Map database is saved to {}", map_db_path_out->value());

        map_db_in = map_db_path_out->value(); // Running in a loop, must build on previous video maps
    }


    db = nullptr;
    ret = sqlite3_open(map_db_path_out->value().c_str(), &db);
    if (ret != SQLITE_OK) {
        spdlog::error("Failed to open SQL database");
        return 1;
    }
    
    save_timestamps_to_sqlite3(db, timestamp_group_list, special_point_group_list);

    sqlite3_close(db);
    


#ifdef USE_GOOGLE_PERFTOOLS
    ProfilerStop();
#endif

    return 0;
}


