import fs from 'node:fs'
import dotenv from 'dotenv'
dotenv.config()

export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;


export const KEYFRAME_IMG_DIR = process.env.KEYFRAME_IMG_DIR ?? "/media/skwangles/KINGSTON/TGA - Out/pictures/";
export const SEND_TEST_IMAGE: boolean = process.env.SEND_TEST_IMAGE === 'true';
export const COORDS_TO_METRES: number = Number(process.env.COORDS_TO_METRES) ?? 10;
export const FLOORPLAN_IMG_DIR = process.env.FLOORPLAN_IMG_DIR ?? "/home/skwangles/Documents/Honours/CampusVirtual/floorplans/";
export const KEYFRAME_IMG_EXTENSION = process.env.KEYFRAME_IMG_EXTENSION ?? ".png";


export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export const NEIGHBOURS_INCLUDES_PROXIMITY: boolean = process.env.NEIGHBOURS_INCLUDES_PROXIMITY === 'true';

export const SQLITE_DB_NAME = process.env.SQLITE_DB_NAME ?? "tga-building.db"
export const SQLITE_DB_DIR = process.env.SQLITE_DB_DIR ?? "/home/davidb/research/code-managed/CampusVirtual-TGA-MEDIA/TGA - Out/MAPS/"


export const ENABLE_AUTHORING_PAGE: boolean = process.env.ENABLE_AUTHORING_PAGE === 'true'; // Sqlite is set to readonly when this is false

export const USE_QUERY_PREFIX: boolean = process.env.USE_QUERY_PREFIX === 'true'; // false = unrefined, true = refined (e.g. use prefix to work out the DB filename to use/load)
export const QUERY_PREFIX = process.env.QUERY_PREFIX ?? "refined_";
export const SKIP_IF_MAP_ALREADY_CONFIGED: boolean = process.env.SKIP_IF_MAP_ALREADY_CONFIGED === 'true';

console.debug("DB files in dir:", fs.readdirSync(SQLITE_DB_DIR))
console.debug("Number of images in image dir:", fs.readdirSync(KEYFRAME_IMG_DIR).length)
console.debug("Env", process.env)
