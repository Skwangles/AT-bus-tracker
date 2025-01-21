Graph pruner using the QuATR reduction algorithm

## cli:

`node dist/main.js --img_dir=/path/to/dir/ <args...>`

### Args:

> Note: All proximities are in 'metres' relative to how the coord\*to_metres factor works  
> Note: All 'directories' should have a '/' character at the end

- img_dir: path to the individual node images
- img_ext: e.g. '.png', '.jpg', etc.
- outer_prox: target proximity when the location is not 'outdoors'
- inner_prox: Always merge proximity when location is not 'outdoors'
- outdoor_outer_prox: target proximity when location is not 'outdoors'
- outdoor_inner_prox: Always merge proximity when location is not 'outdoors'
- y_dist: Vertical distance threshold (i.e. stop too many stair points being removed)
- outdoor_y_dist: 'outdoor' Vertical distance threshold
- table_prefix: e.g. 'refined\*', whatever 'working database' name prefix to copy the nodes to and destructively work on (e.g. the 'nodes' table is copied to 'refined_nodes')
- coords_to_metres: The conversion/scaling factor to convert SLAM's arbitrary coordinate system to a more human friendly metric -
