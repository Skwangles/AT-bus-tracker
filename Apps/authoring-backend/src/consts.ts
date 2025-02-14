import fs from 'node:fs'
import dotenv from 'dotenv'
import logger from './logger';
dotenv.config()

export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;
export const REASONABLE_MAX_STRING_SIZE = 50;


export const RESERVED_START_OF_LABELS = ["!!anchor", "!!elevator", "!!toilet", "$$"]

export const PORT = isNaN(Number(process.env.CV_AUTHORING_PORT)) ? Number(3004) : Number(process.env.CV_AUTHORING_PORT);
export const KEYFRAME_IMG_DIR = process.env.CV_KEYFRAME_IMG_DIR ?? "/media/skwangles/KINGSTON/TGA - Out/pictures/";
export const COORDS_TO_METRES: number = isNaN(Number(process.env.CV_COORDS_TO_METRES)) ? 10 : Number(process.env.CV_COORDS_TO_METRES)
export const FLOORPLAN_IMG_DIR = process.env.CV_SERVER_FLOORPLAN_IMG_DIR ?? "/home/skwangles/Documents/Honours/CampusVirtual/floorplans/";
export const KEYFRAME_IMG_EXTENSION = process.env.CV_SUTHORING_KEYFRAME_IMG_EXTENSION ?? ".png";


export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export const SQLITE_DB_NAME = process.env.CV_AUTHORING_DB_NAME ?? "tga-building.db"
export const SQLITE_DB_DIR = process.env.CV_DB_DIR ?? "/home/davidb/research/code-managed/CampusVirtual-TGA-MEDIA/TGA - Out/MAPS/"

export const USE_TABLE_PREFIX: boolean = process.env.CV_AUTHORING_USE_TABLE_PREFIX === 'true'; // false = unrefined, true = refined (e.g. use prefix to work out the DB filename to use/load)
export const SKIP_IF_MAP_ALREADY_CONFIGED: boolean = process.env.CV_AUTHORING_DONT_OVERWRITE_MAP_POINTS === 'true';
export const TABLE_PREFIX = process.env.CV_AUTHORING_TABLE_PREFIX ?? "refined_";

logger.debug("DB File:" + SQLITE_DB_DIR)
logger.debug("DB files in dir:" + fs.readdirSync(SQLITE_DB_DIR).join(", "))
