import fs from 'node:fs'
import dotenv from 'dotenv'
import logger from './logger';
dotenv.config()

export const BORDERING_FLOOR_POINT_DEFAULT_TYPE = 50;
export const FLOOR_POINT_DEFAULT_TYPE = 0;
export const REASONABLE_MAX_STRING_SIZE = 50;

export enum EdgeType {
  Covisibility = -1,
  Normal,
  Loop,
  MergePoint,
  EdgeContraction,
}

export const SQLITE_DB_NAME = process.env.SX_INIT_DB_NAME ?? "campus.db"
export const SQLITE_DB_DIR = process.env.SX_DB_DIR ?? "/Maps/"

export const SKIP_IF_MAP_ALREADY_CONFIGED: boolean = process.env.SX_INIT_DONT_OVERWRITE_MAP_POINTS === 'true';

logger.debug("DB File:" + SQLITE_DB_DIR)
logger.debug("DB files in dir:" + fs.readdirSync(SQLITE_DB_DIR).join(", "))
