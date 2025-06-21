#pragma once

#include <nlohmann/json.hpp>
#include <stdio.h>


nlohmann::json filename_to_json_obj(std::string json_filename, std::string json_dir){
    nlohmann::json json_obj;
    std::string full_filepath = json_dir + "/" + json_filename;


    std::ifstream json_file(full_filepath.c_str());
    if (!json_file.good()){
        return NULL;
    }
    
    json_file >> json_obj;

    return json_obj;
}



/**
 * @brief Get all user defined points from the data capture .jsons that occurred before the current frame's timestamp (minus those before the offset)
 * The offset should be used as a way to ensure no user defined point is assigned to multiple keyframes
 * 
 * @param obj 
 * @param ms 
 * @param offset 
 * @param points 
 * @return int32_t the offset of points already returned as 'assigned' to a keyframe, start search from offset in future calls 
 */
int32_t get_user_defined_points(nlohmann::json &obj, double &ms, int32_t offset, std::vector<std::string>& points){
    if (ms < 0){
        return offset;
    }

    points.clear();

    double seconds = ms/1000;

    nlohmann::json timecode_array = obj["user_defined"];
    std::string group;


    for (int new_offset = offset; new_offset < timecode_array.size(); new_offset++){
        auto timecode = timecode_array[new_offset];

        double time_ms = timecode["t"];
        
        double time_sec = time_ms/1000;
        if (time_sec > seconds){
            // Current timecode occurs after, so it becomes the new offset 'start'
            return new_offset;
        }

        group = timecode["g"];

        points.push_back(group);
        
    }

    // All user defined points have been consumed
    return timecode_array.size();
}



std::pair<int, double> get_loop_detector_status_from_json(nlohmann::json &obj, double &ms){
    if (ms < 0){
        return std::pair(0, 0);
    }

    double seconds = ms/1000;

    if (!obj.contains("disable_loop")) return std::pair(-1, -1);

    nlohmann::json timecode_array = obj["disable_loop"];
    int status;
    for (auto timecode : timecode_array){

        double time_ms = timecode["t"];
    
        double time_sec = time_ms/1000;
        if (time_sec > seconds){
            return std::pair(status, time_sec); // Return current status, and next time the status changes
        }
        status = (int)timecode["disable"];
    }

    return std::pair(status, __DBL_MAX__);
}

std::string find_group_from_json(nlohmann::json &obj, double &ms){
    if (ms < 0){
        return "";
    }

    double seconds = ms/1000;

    nlohmann::json timecode_array = obj["data"];
    std::string group;
    for (auto timecode : timecode_array){

        double time_ms = timecode["t"];
        
        double time_sec = time_ms/1000;
        if (time_sec > seconds){
            return group; // return the previous group's
        }
        group = timecode["g"];
    }

    return group;
}