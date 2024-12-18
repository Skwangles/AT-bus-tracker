import Pool from 'pg-pool'
import betterSqlite3 from 'better-sqlite3'
import { QueryResult } from 'pg';
import { USE_SQLITE, SQLITE_DB_PATH } from './consts';

let writableSqliteDb: betterSqlite3.Database;
let sqliteDb: betterSqlite3.Database;
// let pgDb: Pool<any>;

function initDB() {
  // if (USE_SQLITE) {
  sqliteDb = betterSqlite3(SQLITE_DB_PATH, { readonly: true })
  writableSqliteDb = betterSqlite3(SQLITE_DB_PATH, { readonly: false })
  // }
  // else {
  //   // TODO: Separate users into read and write access users
  //   const dbConfig = {
  //     user: process.env.DB_USER,
  //     password: process.env.DB_PWD,
  //     database: process.env.DB_NAME,
  //     host: process.env.DB_HOST,
  //     port: Number(process.env.DB_PORT),
  //   }
  //   pgDb = new Pool(dbConfig)
  // }
}

export async function writeDB(query: string, params: any[] = []): Promise<number> {
  // if (USE_SQLITE) {
  return (await writableSqliteDb.prepare(query).run(params)).changes ?? 0
  // }
  // else {
  // return (await pgDb.query(query, params)).rowCount ?? 0
  // }
}

export async function readDB(query: string, params: (string | number)[] = [], isSingle: boolean = false): Promise<any | any[]> {
  // if (USE_SQLITE) {
  const preparedQuery = sqliteDb.prepare(query)
  return isSingle ? await preparedQuery.get(params) as any : await preparedQuery.all(params) as any[]
  // }
  // else {
  //   return (await pgDb.query(query, params)).rows
  // }
}

initDB()
export { readDB as dbQuery }

