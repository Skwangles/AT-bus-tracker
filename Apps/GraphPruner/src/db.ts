import Pool from 'pg-pool'
import betterSqlite3 from 'better-sqlite3'
import { SQLITE_DB_PATH } from './consts';

let writableSqliteDb: betterSqlite3.Database;
let sqliteDb: betterSqlite3.Database;

function initDB() {
  sqliteDb = betterSqlite3(SQLITE_DB_PATH, { readonly: true })
  writableSqliteDb = betterSqlite3(SQLITE_DB_PATH, { readonly: false })
  writableSqliteDb.pragma('journal_mode = WAL')

  writableSqliteDb.function('POWER', (x, y) => Math.pow(Number(x), Number(y)))
  writableSqliteDb.function('ABS', (x) => Math.abs(Number(x)))

  sqliteDb.function('POWER', (x, y) => Math.pow(Number(x), Number(y)))
  sqliteDb.function('ABS', (x) => Math.abs(Number(x)))

}

export async function writeDB(query: string, params: any[] = []): Promise<number> {
  return (await writableSqliteDb.prepare(query).run(params)).changes ?? 0

}

export async function readDB(query: string, params: (string | number)[] = [], isSingle: boolean = false): Promise<any | any[]> {
  if (isSingle) {
    return sqliteDb.prepare(query).get(params)
  }
  return sqliteDb.prepare(query).all(params)
}

initDB()
export { readDB as dbQuery }

