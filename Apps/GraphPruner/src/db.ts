import Pool from 'pg-pool'
import sqlite3 from 'sqlite3'
import dotenv from 'dotenv'

dotenv.config()

const USE_SQLITE = process.env.USE_SQLITE === 'true'

const pgConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
}

let db
if (USE_SQLITE) {
  db = new sqlite3.Database('cv.db')
} else {
  db = new Pool(pgConfig)
}

export default db
