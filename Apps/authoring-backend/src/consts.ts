import fs from 'node:fs'
import dotenv from 'dotenv'
import logger from './logger';
import { EdgeType } from './types';
dotenv.config()

export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;
export const REASONABLE_MAX_STRING_SIZE = 50;
export const REASONABLE_MAX_Y_DIST_THRESHOLD = 10
export const REASONABLE_MAX_XZ_DIST_THRESHOLD = 20


export const RESERVED_START_OF_LABELS = ["!!anchor", "!!elevator", "!!toilet", "$$"]

export const PORT = isNaN(Number(process.env.CV_AUTHORING_PORT)) ? Number(3004) : Number(process.env.CV_AUTHORING_PORT);
export const KEYFRAME_IMG_DIR = process.env.CV_KEYFRAME_IMG_DIR ?? "";
export const COORDS_TO_METRES: number = isNaN(Number(process.env.CV_COORDS_TO_METRES)) ? 10 : Number(process.env.CV_COORDS_TO_METRES)
export const FLOORPLAN_IMG_DIR = process.env.CV_SERVER_FLOORPLAN_IMG_DIR ?? "";
export const KEYFRAME_IMG_EXTENSION = process.env.CV_AUTHORING_KEYFRAME_IMG_EXTENSION ?? ".png";

export const NEIGHBOURS_INCLUDES_PROXIMITY: boolean = process.env.NEIGHBOURS_INCLUDES_PROXIMITY === 'true';

export { EdgeType };

export const SQLITE_DB_NAME = process.env.CV_AUTHORING_DB_NAME ?? "campus.db"
export const SQLITE_DB_DIR = process.env.CV_DB_DIR ?? "maps/"

export const SKIP_IF_MAP_ALREADY_CONFIGED: boolean = process.env.CV_AUTHORING_DONT_OVERWRITE_MAP_POINTS === 'true';

logger.debug("DB File:" + SQLITE_DB_DIR)
logger.debug("DB files in dir:" + fs.readdirSync(SQLITE_DB_DIR).join(", "))
