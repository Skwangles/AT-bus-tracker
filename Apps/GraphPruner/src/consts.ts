export const COORDS_TO_METRES = 10;
export const TARGET_CLOSENESS = 5;
export const ALWAYS_MERGE_CLOSENESS = 1.5;
export const OUTDOORS_ALWAYS_MERGE_CLOSENESS = 0.5;
export const OUTDOORS_TARGET_CLOSENESS = 7;
export const OUTDOORS_Y_DIST_THRESHOLD = 2;
export const Y_DIST_THRESHOLD = 2
export const KEYFRAME_IMG_EXTENSION = ".png"
export const KEYFRAME_IMG_DIR = "/media/skwangles/KINGSTON/TGA - Out/pictures/"
export const OUTDOORS_LOCATION_NAME = "outdoors"

export const QUERY_PREFIX = "refined_"

export const USE_SQLITE = true;
export const SQLITE_DB_PATH = "/media/skwangles/KINGSTON/TGA - Out/MAPS/tga-building.db"

export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction
}