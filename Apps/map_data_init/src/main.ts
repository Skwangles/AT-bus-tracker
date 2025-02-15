import { SKIP_IF_MAP_ALREADY_CONFIGED } from "./consts";
import { closeDb } from "./db";
import initData from "./initData";
import dotenv from 'dotenv'
import logger from "./logger";
dotenv.config()

initData(SKIP_IF_MAP_ALREADY_CONFIGED)
logger.info("Ended map data init")