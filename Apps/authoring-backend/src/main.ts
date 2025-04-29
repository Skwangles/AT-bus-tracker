import path from 'path'
import cors from 'cors'
import express from 'express'
import { PORT } from './consts'
import authoringRoutes from './routes/authoring.routes'
import imageRoutes from './routes/image.routes'
import mapRoutes from './routes/map.routes'
import labelRoutes from './routes/labels.routes'
import pointRoutes from './routes/points.routes'
import locationGroupRoutes from './routes/locationGroups.routes'

import readline from 'readline'
import logger from './logger'
import bodyParser from 'body-parser'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../authoring/dist')))
app.use(express.static(path.join(__dirname, '../immersive/dist')))

app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../authoring/dist', 'index.html'))
})

app.get('/immersive', function (req, res) {
  res.sendFile(path.join(__dirname, '../immersive/dist', 'index.html'))
})

app.use(mapRoutes)
app.use(imageRoutes)
app.use(authoringRoutes)
app.use(labelRoutes)
app.use(pointRoutes)
app.use(locationGroupRoutes)


let exitReader = null;
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  exitReader = readline.createInterface({ input: process.stdin, output: process.stdout })

}

console.log("Configured the server endpoints, starting server...")

app.listen(PORT, (error) => {
  if (error) {
    logger.error(`Error starting server: ${error}`)
    process.exit(1)
  }

  logger.info(`Server running on port ${PORT}`)
  if (exitReader) {
    exitReader.question("Press enter to exit", value => {
      logger.info("User exit called. Exiting gracefully")
      exitReader.close()
      process.exit(0)
    })
  }
})
