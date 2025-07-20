import betterSqlite3 from 'better-sqlite3'
import { SQLITE_DB_DIR, SQLITE_DB_NAME } from './consts';
import path from 'path';
import logger from './logger';

let writableSqliteDb: betterSqlite3.Database;
let sqliteDb: betterSqlite3.Database;

function initDB() {
  const db_file = path.join(SQLITE_DB_DIR, SQLITE_DB_NAME)
  sqliteDb = betterSqlite3(db_file, { readonly: true })
  writableSqliteDb = betterSqlite3(db_file, { readonly: false })
  logger.info("Configured databases: " + db_file)
}

export async function writeDB(query: string, params: any[] = []): Promise<number> {
  logger.verbose(`[writeDB] SQL: ${query} params: ${params}`)
  try {
    return (await writableSqliteDb.prepare(query).run(params)).changes ?? 0
  } catch (error) {
    console.error("Error executing query: ", query, params)
    throw error
  }
}

export async function readDB(query: string, params: (string | number)[] = [], isSingle: boolean = false): Promise<any | any[]> {
  // logger.verbose(`[readDB] SQL: ${query} params: ${params} isSingle:${isSingle}`)
  const preparedQuery = sqliteDb.prepare(query)
  try {
    return isSingle ? await preparedQuery.get(params) as any : await preparedQuery.all(params) as any[]
  } catch (error) {
    console.error("Error executing query: ", query, params)
    throw error
  }
}

initDB()
console.log("Finished initialising DB")
export { readDB as dbQuery }

