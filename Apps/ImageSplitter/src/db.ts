import betterSqlite3 from "better-sqlite3";

let writableSqliteDb: betterSqlite3.Database;
let sqliteDb: betterSqlite3.Database;

export function initDB(path: string) {
  sqliteDb = betterSqlite3(path, { readonly: true });
  writableSqliteDb = betterSqlite3(path, { readonly: false });
  writableSqliteDb.pragma("journal_mode = WAL");

  writableSqliteDb.function("POWER", (x, y) => Math.pow(Number(x), Number(y)));
  writableSqliteDb.function("ABS", (x) => Math.abs(Number(x)));

  sqliteDb.function("POWER", (x, y) => Math.pow(Number(x), Number(y)));
  sqliteDb.function("ABS", (x) => Math.abs(Number(x)));
}

export async function writeDB(
  query: string,
  params: any[] = []
): Promise<number> {
  if (!writableSqliteDb) throw new Error("DB must be initalised first")
  return (await writableSqliteDb.prepare(query).run(params)).changes ?? 0;
}

export async function readDB(
  query: string,
  params: (string | number)[] = [],
  isSingle: boolean = false
): Promise<any | any[]> {
  if (!sqliteDb) throw new Error("DB must be initalised first")
  if (isSingle) {
    return sqliteDb.prepare(query).get(params);
  }
  return sqliteDb.prepare(query).all(params);
}

export function closeDb() {
  writableSqliteDb.close()
  sqliteDb.close()
}

