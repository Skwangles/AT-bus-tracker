export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;
export const KEYFRAME_IMG_DIR = '/media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/pictures'
export const SEND_TEST_IMAGE = false
export const COORDS_TO_METRES = 10;
export const FLOORPLAN_IMAGE_DIR = "/home/skwangles/Documents/Honours/CampusVirtual/floorplans/"
export const KEYFRAME_IMG_EXTENSION = ".png"

export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction
}

export const NEIGHBOURS_INCLUDES_PROXIMITY = true;

export const USE_SQLITE = true;
export const SQLITE_DB_PATH = "/media/skwangles/KINGSTON/MEDIA/RawINSV/Zones/Maps/merged.db"

export const ENABLE_AUTHORING_PAGE = true; // Sqlite is set to readonly when this is false

export const USE_QUERY_PREFIX = false;
export const QUERY_PREFIX = "refined_"