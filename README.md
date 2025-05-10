
![CampusVirtual: Large-scale Low-cost Panoramic Virtual Tours](logo/CampusVirtualLogo.png)

## Installing

Clone `git clone --recursive https://github.com/Skwangles/CampusVirtual.git`
Super important that you do it _recursive_, as we have submodules that need cloned for this project to build.
Many of these submodules are private, so you may unfortunately need to manually clone them yourself

## Background Info

This project takes in Equirectangular videos (in our case stitched from Insta360 INSV files),
these Equirectangular videos are then paired with JSON files describing at what time in the video was special points of interest, and when the video moved into different buildings and floors (e.g. floor 1 0-20secs, floor 2 21-50sec, etc. ).

A VSLAM library is then used to track the path of the video and build an XYZ graph, where each node is associated to an image extracted from the video.

We then convert the VSLAM database's Sqlite3 "Maps" to our own custom 'Campus Virtual' DB files
(also Sqlite3, but a nodes/edges structure).

From here we can do various things, like edit the converted/exported db file with a viewer,
apply a graph pruning process to clean up graph so points aren't so bunched together.

Or we can even merge different (zones) DBs into a single DB representing larger areas comprised of 'zones'.

Once we are satisfied with the map we can then serve it to users.
One step is to use a tool to extract only the used images, as there are a lot of Equirectangular images so we want to minimise the storage used to serve it.
We then serve it using a React backend that has an extra `<url>/authoring` page to align the points to 2D floorplan/map images, but this isn't required for the interface to work.
Finally, the users can click and move around jumping from red dot to red dot, where each dot represents an image and is positioned relative to one another's real world space relationship.

## Required Libs

- Docker - [https://www.docker.com/get-started/](https://www.docker.com/get-started/) - Used for Postgres Database (or not if you just use SQLite3)
- Stella VSLAM - https://github.com/Skwangles/stella_vslam.git - Forked version used for pose tracking (automatically installed by BUILD_LIBS.sh)

### Installed by BUILD_LIBS.sh

- OpenCV
- Stella VSLAM
- g2o
- Stella VSlam custom FBoW implementation
- Iridescence
- Node JS

## To use

- Run `source SOURCE_SETUP.sh`
- Copy .env.exampe to .env and update with your config
- Run RUNME.sh (It should run `BUILD_LIBS` and `BUILD_CAMPUSVIRTUAL.sh` for you)
  - Note: Make sure the submodules from .gitmodules have been downloaded, otherwise you may have to do this yourself

If the dots seem too far apart in the served version (campusvirtual-backend), you may need to adjust the coords_to_metres constant in the campusvirtual-backend/ui/src/consts.ts, so the points being scaled doesn't cause an issue.

The RUNME calls running scripts, for direct use, are `bin/scripts/cv_run_X.sh`.
Most of these should have cli args you can pass in to bypass the usage of .env (other than general vars like CV_HOME_DIR, CV_DB_DIR, etc.)

### Examples

The /examples directory should show you how you can modify the RUNME.sh to do more complex actions like processing videos
in multiple mapping steps (i.e. progressively mapping)

## Optional Further Steps

If you would like to blur faces, I suggest using a library like:
https://github.com/thaytan/blur360
It is slow, and intensive, however, will likely help

# DB

## Nodes

Nodes represent a point in space relative to the real world.
Node points can come in different types - elevator (1) and image (0 - normal points)
Types:
=

## Edge

Connects nodes together as a navigable path - these edges show up on the minimap in the top left, so don't go overboard - eventually should make it transitive simplified?

- Idea: Localwindow search with DFS?

Types:

- Covisibility = -1 - when two points share X number of 'landmarks', they become covisibilities, that's what these edges are - effectively 'can they see each other;
- Normal, - Pathfinable and neighbouring
- Loop - Slam's point to identify an edge as making a loop
- MergePoint - Idea is that 'Zones' will allow the technology to expand to very largescale, rather than the accumulated drift. These points note the points where you are expecting to line up exactly
- EdgeContraction - Pruned edge made as a result of a node reduction (i.e. created between nodes by proximity, rather than sequential or loop closures, though often times bridge where a sequential connection might be because of node-reduction complications)
- PathfindOnly - Pathfindable, but should not actually be used for the GetNeighbours search

# Modules

### CampusVirtual-FileProcessing - Insta360 SDK and image processor

- Interface on top of Insta360's Linux SDK for image/video stitching
- You must `sudo apt-get install ./sdk.deb` the SDK from Insta360 by applying for it a : https://www.insta360.com/sdk/apply

### SLAM - Stella VSLAM modifications

- Uses Stella VSLAM
- Feeds in video frames into Stella to build a Sqlite3 map
- Feeds in JSON files the same name as the video input, which has the timecodes of what location the video was in at what time.
- Saves keyframes to an output directory (these are read in for the web interface, and can be a very large directory, so choose carefully)

#### Using the JSON files

Using the JSON files created by thge

### RunCampusVirtual - C++ Interface

- User friendly interface to use Stella
  - Has a headless and live mapping viewer option (see the map as it is built using iridescence as a map viewer)
  - Allows you to pass in multiple videos in an order based on a parent directory
  - Pairs JSON location files to keyframes based on timestamps
  - Allows converting SLAM to postgres/sqlite database for viewing

Note: The `type` field in the edges (or refined_edges) tables are 0 = normal edge, 1 = loop edge, 2 = edge between zones, -1 = Covisibility (i.e. frame has enough overlap in landmarks to be 'line of sight')

### MapMerger

In the case of trying to merge two maps together, you must have atleast two 'special points' marked with `$$` at the start, marking a merge point.
At least these 2 merge points are needed to find what rotation and translation best aligns the points.
Uses Procrustes Analysis to calculate the optimal rotation (only does so in
XZ plane, because the points should already be horizontally aligned).
VSLAM in equirectangular mode uses Y as the vertical coordinate (i.e. XZ = ground plane).

TODO: Implement a manual alignment method

### Authoring page

This is separate from the campusvirtual backend, so when serving to users you can serve without worry for giving a write access to the DB.
This authoring page should only be used/made available to an admin to configure and edit the maps/floorplans.
If this has not been run before campusvirtual, then the maps (floorplan_images and floorplan_points tables) will not be initalised

- On first run, it loads all points from refined_nodes, refined_edges, and refined_node_locations into a db for map editing by the authoring page. (you can also define the TABLE_PREFIX as empty to just use the unrefined/raw database)
- Note: The Authoring page needs to be enabled in the .env file by enabling 'ENABLE_AUTHORING_PAGE` in the .env file, this is because it has GET/POST/UPDATE/DELETE routes for creating new points, updating existing points, and deleting points, that shouldn't be used in production.
  I haven't bothered with any authentication because we can just disable it when it goes public.

### campusvirutal-backend and ui/

- React frontend using THREE.js to visualise the graph, pathfind, and navigate the info present in the PostgreSQL DB

Once you have built a map, it pays to visit the `ui/src/const.ts` to adjust the dotsize and manual y offset of the dots to be visually appealing - The Coords to metres scaling should generally base off the .env, so the manual adjustment should only be done if they don't look good with that adjusted  
There is an API_PREFIX field if you wanted the front-end to be served on a different domain to the backend.
(e.g. `API_PREFIX="localhost:3001"` when the frontend is being developed with `npm run dev` on `localhost:5173`)

Note: The `type` field of the floorplan_points is 0-49 = Normal points (e.g. bathroom, drinking fountain, etc.), 50+ = Border nodes (e.g. doors, stairs, etc.) - The large number set is to give future extensibility to types

## SharpnessCalculator

Used to preprocess the laplacian sharpness of the images.
Outputs a JSON file that the GraphPruner uses to speed up.
`python3 sharpness.py /abs/img/dir/ /abs/output/file.json`

## ImageSplitter

A tool to read the node's table on a Sqlite3 database and find what images (named after each nodes' timestamp to 5dp) are used, and copy them to a defined area.
`npm run start -- --input_dir="INPUT_DIR" --output_dir="OUTPUT_DIR"`

## graph-pruner

Pruner for the node, edges, and node_locations tables in PostgreSQL DB, before writing out to refined_X versions of the aforementioned tables.
This pruner uses its consts.ts to prune the underlying model, and output them in a format ready for campusvirtual-backend to serve.
It uses DFS to traverse the graph and prune the paths.
Accepts a JSON file to lookup the sharpness of images instead of calculating them at run time (expensive operation)

e.g. `npm run start -- --img_dir='/media/skwangles/KINGSTON/TGA - Out/pictures/' --preproc_sharpness_json='/media/skwangles/KINGSTON/TGA - Out/sharpness.json' --table_prefix='prune_test_'`

# runCampusVirtual CLI

```
Allowed options:
  -h [ --help ]                  produce help message (though must have all others to get this to run, an oddity I haven't bothered to fix)
  --headless arg (=0)            Use headless (true|false)
  --project_dir arg              Campus virtual project directory
  --media_dir arg                Media directory - videos
  --map_dir arg                  Map directory - maps
  --videos arg                   Comma-separated ordered videos
  --in arg                       Input map (*.db)
  --out arg                      Output map (*.db)
  --json_dir arg                 JSON group-to-timestamp file directory
  --convertToGraph               Convert to graph (optional)
  --convertToPg                  Convert to Postgres (optional)
  --picture-dir arg (=pictures/) Keyframe image output dir - Default
                                 'pictures/'
```

# CampusVirtual Environment Management System

This system provides a flexible and secure way to manage environment configurations for different deployment scenarios. It uses a combination of JSON configuration files and environment files to manage settings across different environments.

## System Architecture

```mermaid
graph TD
    A[RUNME.sh] --> B[env_manager.sh]
    B --> C[Load Base .env]
    B --> D[Load Profile Config]
    B --> E[Load .env.secrets]
    B --> F[Load Project Secrets]
    
    D --> G[Process Features]
    D --> H[Process Paths]
    D --> I[Process Config]
    
    G --> J[Export Variables]
    H --> J
    I --> J
    C --> J
    E --> J
    F --> J
```

## Configuration Flow

```mermaid
sequenceDiagram
    participant User
    participant RUNME
    participant EnvManager
    participant Config
    participant Secrets
    
    User->>RUNME: ./RUNME.sh <profile>
    RUNME->>EnvManager: Load Configuration
    EnvManager->>Config: Load Base .env
    EnvManager->>Config: Load Profile JSON
    EnvManager->>Secrets: Load .env.secrets
    EnvManager->>Secrets: Load Project Secrets
    EnvManager->>Config: Process Features
    EnvManager->>Config: Process Paths
    EnvManager->>Config: Process Config
    EnvManager->>User: Export Variables
```

## Configuration Structure

```mermaid
classDiagram
    class Profile {
        +String name
        +Features features
        +Paths paths
        +Config config
        +String env_file
    }
    
    class Features {
        +Boolean stitch_insv
        +Boolean vslam_map
        +Boolean edit_vslam
        +Boolean export_db
        +Boolean start_authoring
        +Boolean start_server
    }
    
    class Paths {
        +String home_dir
        +String video_dir
        +String image_dir
        +String db_dir
        +String vslam_map_dir
        +String json_dir
        +String floorplan_dir
    }
    
    class Config {
        +Integer keyframe_img_name_dp
        +String stitch_resolution
        +Integer vslam_epoch_start
        +Boolean vslam_map_headless
        +String server_port
        +Array strip_remove
        +Array strip_keep_labels
    }
    
    Profile --> Features
    Profile --> Paths
    Profile --> Config
```

## Usage

1. **Base Configuration**
   Create a `.env` file in the project root with common settings:
   ```bash
   CV_HOME_DIR=/path/to/campusvirtual
   CV_VIDEO_DIR=/path/to/videos
   CV_KEYFRAME_IMG_DIR=/path/to/images
   ```

2. **Profile Configuration**
   Create a JSON configuration file in the `configs` directory (e.g., `configs/tga.json`):
   ```json
   {
     "name": "tga",
     "features": {
       "start_authoring": true,
       "start_server": true
     },
     "paths": {
       "home_dir": "/path/to/campusvirtual",
       "video_dir": "/path/to/videos"
     },
     "config": {
       "stitch_resolution": "5760x2880",
       "server_port": 3001
     }
   }
   ```

3. **Sensitive Data**
   Create a `.env.secrets` file for sensitive information:
   ```bash
   POSTHOG_API_KEY=your_api_key_here
   POSTHOG_HOST=https://app.posthog.com
   ```

4. **Running the System**
   ```bash
   ./RUNME.sh tga
   ```

## Environment Variables

The system processes three types of configurations:

1. **Features**: Boolean flags that control system behavior
   - `CV_STITCH_INSV`
   - `CV_VSLAM_MAP`
   - `CV_START_AUTHORING`
   - `CV_START_SERVER`

2. **Paths**: Directory locations
   - `CV_HOME_DIR`
   - `CV_VIDEO_DIR`
   - `CV_IMAGE_DIR`
   - `CV_DB_DIR`
   - `CV_VSLAM_MAP_DIR`
   - `CV_JSON_DIR`
   - `CV_FLOORPLAN_DIR`

3. **Config**: System configuration parameters
   - `CV_KEYFRAME_IMG_NAME_DP`
   - `CV_STITCH_RESOLUTION`
   - `CV_VSLAM_EPOCH_START`
   - `CV_SERVER_PORT`
   - `CV_STRIP_REMOVE`
   - `CV_STRIP_KEEP_LABELS`

## Security

The system implements several security measures:

1. Sensitive data is kept in `.env.secrets` files
2. Project-specific secrets are isolated in their respective directories
3. Environment variables are processed securely with proper validation
4. JSON configuration files are validated before processing

## Error Handling

The system includes comprehensive error handling:

1. Validates JSON configuration files
2. Checks for required environment variables
3. Validates file existence
4. Provides clear error messages
5. Handles array conversions safely

## Best Practices

1. Keep sensitive data in `.env.secrets` files
2. Use meaningful profile names
3. Document configuration changes
4. Validate JSON before committing
5. Use environment variable substitution for dynamic values
6. Keep project-specific secrets isolated
