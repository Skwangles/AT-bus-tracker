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

### campusvirutal-backend and ui/ and authoring/

- React frontend using THREE.js to visualise the graph, pathfind, and navigate the info present in the PostgreSQL DB
  On first run, it loads all points from refined_nodes, refined_edges, and refined_node_locations into a db for map editing by the authoring page. (you can also define the TABLE_PREFIX as empty to just use the unrefined/raw database)
- Note: The Authoring page needs to be enabled in the .env file by enabling 'ENABLE_AUTHORING_PAGE` in the .env file, this is because it has GET/POST/UPDATE/DELETE routes for creating new points, updating existing points, and deleting points, that shouldn't be used in production.
  I haven't bothered with any authentication because we can just disable it when it goes public.

Once you have built a map, it pays to visit the `ui/src/const.ts` to adjust the dotsize and manual y offset of the dots to be visually appealing - there is an API_PREFIX field if you wanted the front-end to be served on a different domain to the backend.
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
