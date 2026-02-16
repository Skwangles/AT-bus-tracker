import { SKIP_IF_MAP_ALREADY_CONFIGED } from "./consts";
import initData from "./initData";
import dotenv from 'dotenv'
import logger from "./logger";
import { closeDb } from "./db";
dotenv.config()

initData(SKIP_IF_MAP_ALREADY_CONFIGED)
closeDb()
logger.info("Ended map data init")