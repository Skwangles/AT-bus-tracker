import betterSqlite3 from 'better-sqlite3'
import { SQLITE_DB_DIR, SQLITE_DB_NAME, TABLE_PREFIX, USE_TABLE_PREFIX } from './consts';
import path from 'path';
import logger from './logger';

let writableSqliteDb: betterSqlite3.Database;
let sqliteDb: betterSqlite3.Database;

async function initDB() {
  const db_file = path.join(SQLITE_DB_DIR, SQLITE_DB_NAME)
  sqliteDb = betterSqlite3(db_file, { readonly: true })
  writableSqliteDb = betterSqlite3(db_file, { readonly: false })
  logger.info("Configured databases: " + db_file)


  const fp_images = await readDB(`SELECT COUNT(name) as count FROM sqlite_master WHERE type='table' AND name='${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_images';`)
  const fp_points = await readDB(`SELECT COUNT(name) as count FROM sqlite_master WHERE type='table' AND name='${USE_TABLE_PREFIX ? TABLE_PREFIX : ""}floorplan_points';`)
  process.env.IS_FLOORPLANS_EXISTS = fp_images.count === 1 && fp_points.count === 1 ? 'true' : 'false'
}

// export async function writeDB(query: string, params: any[] = []): Promise<number> {
//   logger.verbose(`[writeDB] SQL: ${query} params: ${params}`)
//   return (await writableSqliteDb.prepare(query).run(params)).changes ?? 0
// }

export async function readDB(query: string, params: (string | number)[] = [], isSingle: boolean = false): Promise<any | any[]> {
  logger.verbose(`[readDB] SQL: ${query} params: ${params} isSingle:${isSingle}`)
  const preparedQuery = sqliteDb.prepare(query)
  return isSingle ? await preparedQuery.get(params) as any : await preparedQuery.all(params) as any[]
}

initDB()
export { readDB as dbQuery }

