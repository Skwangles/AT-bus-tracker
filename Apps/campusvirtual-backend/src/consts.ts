import dotenv from 'dotenv'
dotenv.config()

export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;


export const KEYFRAME_IMG_DIR = process.env.KEYFRAME_IMG_DIR ?? "/media/skwangles/KINGSTON/TGA - Out/pictures/";
export const SEND_TEST_IMAGE: boolean = Boolean(process.env.SEND_TEST_IMAGE) ?? false;
export const COORDS_TO_METRES: number = Number(process.env.COORDS_TO_METRES) ?? 10;
export const FLOORPLAN_IMG_DIR = process.env.FLOORPLAN_IMG_DIR ?? "/home/skwangles/Documents/Honours/CampusVirtual/floorplans/";
export const KEYFRAME_IMG_EXTENSION = process.env.KEYFRAME_IMG_EXTENSION ?? ".png";

console.log("Dirs", KEYFRAME_IMG_DIR, FLOORPLAN_IMG_DIR, process.env)

export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export const NEIGHBOURS_INCLUDES_PROXIMITY: boolean = Boolean(process.env.NEIGHBOURS_INCLUDES_PROXIMITY) ?? false;

export const USE_SQLITE: boolean = Boolean(process.env.USE_SQLITE) ?? true;
export const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH ?? "/home/davidb/research/code-managed/CampusVirtual-TGA-MEDIA/TGA - Out/MAPS/tga-building.db"

export const ENABLE_AUTHORING_PAGE: boolean = Boolean(process.env.ENABLE_AUTHORING_PAGE) ?? true; // Sqlite is set to readonly when this is false

export const USE_QUERY_PREFIX: boolean = Boolean(process.env.USE_QUERY_PREFIX) ?? true; // false = unrefined, true = refined (e.g. use prefix to work out the DB filename to use/load)
export const QUERY_PREFIX = process.env.QUERY_PREFIX ?? "refined_";
export const SKIP_IF_MAP_ALREADY_CONFIGED: boolean = Boolean(process.env.SKIP_IF_MAP_ALREADY_CONFIGED) ?? false;
