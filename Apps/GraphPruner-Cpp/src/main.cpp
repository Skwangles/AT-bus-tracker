#include <sqlite3.h>
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <thread>
#include <mutex>
#include <opencv2/opencv.hpp>
#include <boost/program_options.hpp>

double TARGET_CLOSENESS = 5.0; 
double ALWAYS_MERGE_CLOSENESS = 2.0;
double Y_DIST_THRESHOLD = 2.0;
std::string KEYFRAME_IMG_DIR = "./keyframes/";
std::string KEYFRAME_IMG_EXTENSION = ".jpg";
std::string OUTDOORS_LOCATION_NAME = "outdoors";
double OUTDOORS_TARGET_CLOSENESS = 10.0; 
double OUTDOORS_ALWAYS_MERGE_CLOSENESS = 5.0;
double OUTDOORS_Y_DIST_THRESHOLD = 5.0;
std::string QUERY_PREFIX = "refined_";

// Define a struct to hold node information
struct NodeInfo {
    int keyframe_id;
    double ts;
    std::vector<double> position;
    std::string location;
};

// Database class for SQLite3
class Database {
public:
    Database(std::string db_path) {
        int rc = sqlite3_open(db_path, &db);
        if (rc != SQLITE_OK) {
            std::cerr << "Cannot open database: " << sqlite3_errmsg(db) << std::endl;
        }
    }

    ~Database() {
        sqlite3_close(db);
    }

    bool executeQuery(const std::string& query) {
        char* errMsg = nullptr;
        int rc = sqlite3_exec(db, query.c_str(), nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            std::cerr << "SQL error: " << errMsg << std::endl;
            sqlite3_free(errMsg);
            return false;
        }
        return true;
    }

    std::vector<std::vector<std::string>> query(const std::string& query) {
        std::vector<std::vector<std::string>> results;
        sqlite3_stmt* stmt;
        int rc = sqlite3_prepare_v2(db, query.c_str(), -1, &stmt, nullptr);
        if (rc != SQLITE_OK) {
            std::cerr << "Prepare statement failed: " << sqlite3_errmsg(db) << std::endl;
            return results;
        }

        while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
            std::vector<std::string> row;
            for (int col = 0; col < sqlite3_column_count(stmt); ++col) {
                row.push_back(reinterpret_cast<const char*>(sqlite3_column_text(stmt, col)));
            }
            results.push_back(row);
        }

        sqlite3_finalize(stmt);
        return results;
    }

private:
    sqlite3* db;
};

int getFirstKeyframeID(Database& db) {
    std::vector<std::vector<std::string>> results = db.query("SELECT keyframe_id FROM " + QUERY_PREFIX + "nodes WHERE keyframe_id >= 0 LIMIT 1;");
    if (results.size() == 0){
        return -1;
    }
    return std::stoi(results[0][0]);
}

// Function to get node position from database
std::vector<double> getNodePosition(const int keyframe_id, Database& db) {
    std::string query = "SELECT x_trans, y_trans, z_trans FROM " + QUERY_PREFIX + "nodes WHERE keyframe_id = " + std::to_string(keyframe_id);
    std::vector<std::vector<std::string>> results = db.query(query);

    if (results.size() == 0) {
        return {}; // Handle case where node is not found
    }

    std::vector<double> position(3);
    position[0] = std::stod(results[0][0]);
    position[1] = std::stod(results[0][1]);
    position[2] = std::stod(results[0][2]);
    return position;
}

// Function to get node information from database
NodeInfo getNodeInfo(const int keyframe_id, Database& db) {
    std::string query = "SELECT ts, x_trans, y_trans, z_trans, location FROM " + QUERY_PREFIX + "nodes JOIN " + QUERY_PREFIX + "node_locations ON " + QUERY_PREFIX + "nodes.keyframe_id = " + QUERY_PREFIX + "node_locations.keyframe_id WHERE " + QUERY_PREFIX + "nodes.keyframe_id = " + std::to_string(keyframe_id);
    std::vector<std::vector<std::string>> results = db.query(query);

    if (results.size() == 0) {
        // Handle case where node is not found
        return {}; 
    }

    NodeInfo node_info;
    node_info.keyframe_id = keyframe_id;
    node_info.ts = std::stod(results[0][0]);
    node_info.position = {std::stod(results[0][1]), std::stod(results[0][2]), std::stod(results[0][3])};
    node_info.location = results[0][4];
    return node_info;
}

// Function to get neighbours of a node
std::vector<int> getNeighbours(const int keyframe_id, Database& db) {
    std::string query = "SELECT keyframe_id1 FROM " + QUERY_PREFIX + "edges WHERE keyframe_id0 = " + std::to_string(keyframe_id);
    std::vector<std::vector<std::string>> results = db.query(query);

    std::vector<int> neighbours;
    for (const auto& row : results) {
        neighbours.push_back(std::stoi(row[0]));
    }
    return neighbours;
}

// Function to check if node is outdoors
bool isNodeOutdoors(const int keyframe_id, Database& db) {
    NodeInfo node_info = getNodeInfo(keyframe_id, db);
    return node_info.location == OUTDOORS_LOCATION_NAME;
}

// Function to replace a node in the database
bool replaceNode(const int keyframe_id, const std::vector<double>& position, bool ignore_distance, bool isOutdoors, Database& db) {
    // 1. Delete edges related to the node
    std::string deleteEdgesQuery = "DELETE FROM " + QUERY_PREFIX + "edges WHERE keyframe_id0 = " + std::to_string(keyframe_id) + " OR keyframe_id1 = " + std::to_string(keyframe_id);
    if (!db.executeQuery(deleteEdgesQuery)) {
        return false;
    }

    // 2. Delete node_locations record
    std::string deleteLocationQuery = "DELETE FROM " + QUERY_PREFIX + "node_locations WHERE keyframe_id = " + std::to_string(keyframe_id);
    if (!db.executeQuery(deleteLocationQuery)) {
        return false;
    }

    // 3. Delete node record
    std::string deleteNodeQuery = "DELETE FROM " + QUERY_PREFIX + "nodes WHERE keyframe_id = " + std::to_string(keyframe_id);
    if (!db.executeQuery(deleteNodeQuery)) {
        return false;
    }

    // 4. (If applicable) Create new edges between neighbours
    // ... (Implement logic to create new edges based on neighbour distances)

    return true;
}

// Function to calculate image sharpness using OpenCV
double calculateImageSharpness(const std::string& filepath) {
    cv::Mat image = cv::imread(filepath, cv::IMREAD_GRAYSCALE);
    if (image.empty()) {
        std::cerr << "Error loading image: " << filepath << std::endl;
        return 0.0;
    }

    cv::Mat laplacian;
    cv::Laplacian(image, laplacian, CV_64F);
    cv::Scalar mean, stddev;
    cv::meanStdDev(laplacian, mean, stddev);
    return stddev[0]; // Return standard deviation of Laplacian
}

// Main function
int main(int argc, char* argv[]) {

    popl::OptionParser op("Allowed options");
     auto help = op.add<popl::Switch>("h", "help", "Produce help message");
    auto db_path = op.add<popl::Value<std::string>>("i", "db", "Sqlite3 Database File (e.g. Sqlite3.db)"); 

    auto target_closeness = op.add<popl::Value<double>>("tc", "target-closeness", "Target closeness for indoor nodes (meters)", TARGET_CLOSENESS);
    auto always_merge_closeness = op.add<popl::Value<double>>("amc", "always-merge-closeness", "Always merge closeness for indoor nodes (meters)", ALWAYS_MERGE_CLOSENESS);
    auto y_dist_threshold = op.add<popl::Value<double>>("ydt", "y-dist-threshold", "Y-distance threshold for indoor nodes (meters)", Y_DIST_THRESHOLD);

    auto keyframe_img_dir = op.add<popl::Value<std::string>>("kid", "keyframe-img-dir", "Directory containing keyframe images", KEYFRAME_IMG_DIR);
    auto keyframe_img_ext = op.add<popl::Value<std::string>>("kie", "keyframe-img-ext", "Extension of keyframe images", KEYFRAME_IMG_EXTENSION);

    auto outdoors_location_name = op.add<popl::Value<std::string>>("oln", "outdoors-location-name", "Name of the location for outdoor nodes", OUTDOORS_LOCATION_NAME);
    auto outdoors_target_closeness = op.add<popl::Value<double>>("otc", "outdoors-target-closeness", "Target closeness for outdoor nodes (meters)", OUTDOORS_TARGET_CLOSENESS);
    auto outdoors_always_merge_closeness = op.add<popl::Value<double>>("oamc", "outdoors-always-merge-closeness", "Always merge closeness for outdoor nodes (meters)", OUTDOORS_ALWAYS_MERGE_CLOSENESS);
    auto outdoors_y_dist_threshold = op.add<popl::Value<double>>("oydt", "outdoors-y-dist-threshold", "Y-distance threshold for outdoor nodes (meters)", OUTDOORS_Y_DIST_THRESHOLD);

    auto query_prefix = op.add<popl::Value<std::string>>("qp", "query-prefix", "Prefix for database tables (e.g. refined_)", QUERY_PREFIX);

    try {
        op.parse(argc, argv);
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        std::cerr << std::endl << op << std::endl;
        return 1;
    }

    


    if (help->is_set()) {
        std::cout << op << std::endl;
        return 0;
    }

    if (!db_path->is_set()) {
        std::cout << "Must specify a database file e.g. --db path/to/db.db" << std::endl;
        return 1;
    }
    
    // Copy over config
    TARGET_CLOSENESS = target_closeness->value();
    ALWAYS_MERGE_CLOSENESS = always_merge_closeness->value();
    Y_DIST_THRESHOLD = y_dist_threshold->value();
    KEYFRAME_IMG_DIR = keyframe_img_dir->value();
    KEYFRAME_IMG_EXTENSION = keyframe_img_ext->value();

    OUTDOORS_LOCATION_NAME = outdoors_location_name->value();
    OUTDOORS_TARGET_CLOSENESS = outdoors_target_closeness->value();
    OUTDOORS_ALWAYS_MERGE_CLOSENESS = outdoors_always_merge_closeness->value();
    OUTDOORS_Y_DIST_THRESHOLD = outdoors_y_dist_threshold->value();

    QUERY_PREFIX = query_prefix->value();
    

    Database db(db_path->value()); 

    int currentKeyframeId = 0; 
    currentKeyframeId = getFirstKeyframeID(db);



    std::stack<int> stack;
    stack.push(currentKeyframeId);
    std::unordered_set<int> visited;
    std::map<int, double> sharpnessValues;

    while (!stack.empty()) {
        currentKeyframeId = stack.top();
        stack.pop();
        if (visited.count(currentKeyframeId) > 0) continue;
        visited.insert(currentKeyframeId);

        NodeInfo nodeInfo = getNodeInfo(currentKeyframeId, db);
        std::vector<double> currentPosition = nodeInfo.position;
        bool isOutdoors = isNodeOutdoors(currentKeyframeId, db);

        // Sharpness Heuritstic
        std::string imagePath = KEYFRAME_IMG_DIR + std::to_string(nodeInfo.ts) + KEYFRAME_IMG_EXTENSION;
        double currentSharpness = 0.0;
        if (sharpnessValues.count(currentKeyframeId) == 0) {
            currentSharpness = calculateImageSharpness(imagePath);
            sharpnessValues[currentKeyframeId] = currentSharpness;
        } else {
            currentSharpness = sharpnessValues[currentKeyframeId];
        }

        bool isCurrentDeleted = false;
        std::unordered_set<int> checkedNeighbours;
        bool neighboursHaveChanged = true;
        while (neighboursHaveChanged && !isCurrentDeleted) {
            std::vector<int> neighbours = getNeighbours(currentKeyframeId, db);
            neighboursHaveChanged = false;

            for (int neighbourId : neighbours) {
                if (checkedNeighbours.count(neighbourId) > 0) continue;
                checkedNeighbours.insert(neighbourId);

                std::vector<double> neighbourPosition = getNodePosition(neighbourId, db);
                double distance = calculateXZDistance(currentPosition, neighbourPosition);
                double yDistance = std::abs(neighbourPosition[1] - currentPosition[1]);

                if (yDistance > (isOutdoors ? OUTDOORS_Y_DIST_THRESHOLD : Y_DIST_THRESHOLD)) {
                    continue;
                }

                if (distance < (isOutdoors ? OUTDOORS_TARGET_CLOSENESS : TARGET_CLOSENESS) ||
                    distance < (isOutdoors ? OUTDOORS_ALWAYS_MERGE_CLOSENESS : ALWAYS_MERGE_CLOSENESS)) {

                    

                    double neighbourSharpness = sharpnessValues[neighbourId];
                    if (neighbourSharpness <= currentSharpness) {
                        // Replace neighbour node
                        if (replaceNode(neighbourId, neighbourPosition, distance <= (isOutdoors ? OUTDOORS_ALWAYS_MERGE_CLOSENESS : ALWAYS_MERGE_CLOSENESS), isOutdoors, db)) {
                            neighboursHaveChanged = true;
                            visited.insert(neighbourId);
                        }
                    } else {
                        // Current is deleted after all neighbours are measured 
                        if (!isCurrentDeleted) {
                            isCurrentDeleted = true;
                        }
                    }
                }
            }
        }

        if (isCurrentDeleted) {
            replaceNode(currentKeyframeId, currentPosition, false, isOutdoors, db);
        }
    }

    return 0;
}