import Pool from 'pg-pool'
import sqlite3 from 'sqlite3'
import dotenv from 'dotenv'

dotenv.config()

const pgConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PWD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
}

let db
db = new Pool(pgConfig)

export default db
