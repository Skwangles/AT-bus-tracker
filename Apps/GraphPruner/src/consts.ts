export const DFLT_COORDS_TO_METRES = 10;
export const DFLT_TARGET_CLOSENESS = 5;
export const DFLT_ALWAYS_MERGE_CLOSENESS = 0.5;
export const DFLT_OUTDOORS_ALWAYS_MERGE_CLOSENESS = 1;
export const DFLT_OUTDOORS_TARGET_CLOSENESS = 7;
export const DFLT_OUTDOORS_Y_DIST_THRESHOLD = 2;
export const DFLT_Y_DIST_THRESHOLD = 2;
export const DFLT_KEYFRAME_IMG_EXTENSION = ".png";
export const DFLT_KEYFRAME_IMG_DIR =
  "/media/skwangles/KINGSTON/TGA - Out/pictures/";
export const DFLT_OUTDOORS_LOCATION_NAME = "outdoors";

export const DFLT_TABLE_PREFIX = "refined_";

export const DFLT_USE_SQLITE = true;
export const DFLT_SQLITE_DB_PATH =
  "/media/skwangles/KINGSTON/TGA - Out/MAPS/tga-building.db";
export const DFLT_PREPROCESSED_IMG_SHARPNESS_JSON = "sharpness.json";

export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export interface NodeInfo {
  position: any;
  label_count: number;
  ts: number | string;
  pose: number[];
  x_trans: number;
  y_trans: number;
  z_trans: number;
}
