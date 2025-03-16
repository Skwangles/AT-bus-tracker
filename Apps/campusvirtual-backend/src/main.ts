import path from 'path'
import cors from 'cors'
import express from 'express'
import { PORT } from './consts'
import pointsRoutes from './routes/points.routes'
import imageRoutes from './routes/image.routes'
import locationGroupRoutes from './routes/locationGroups.routes'
import mapRoutes from './routes/map.routes'
import logger from './logger'
import cluster from 'cluster'
import os from 'os'
import { rateLimit } from 'express-rate-limit'

const numCPUs = os.cpus().length // Get the number of CPU cores



// If this is the master process, fork workers
if (cluster.isPrimary) {
  logger.info(`Primary process is running. Forking ${numCPUs} workers...`)

  // Fork worker processes for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork() // This creates a worker for each CPU core
  }

  // When a worker dies, log the event
  cluster.on('online', (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`)
  })

  // When a worker dies, log the event
  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`)
  })
} else {
  // Worker process (each worker will run the Express server)
  const app = express()

  logger.info(`Setting up express on ${PORT}`)

  app.use(cors({ origin: '*' }))
  app.use(express.static(path.join(__dirname, '../ui/dist')))


  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute - i.e. you can't visit that many buttons
    limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
    standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
    // store: ... , // Redis, Memcached, etc. See below.
  })

  // Apply the rate limiting middleware to all requests.
  app.use(limiter)

  // Render browser
  app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
  })

  // Register routes
  app.use(pointsRoutes)
  app.use(imageRoutes)
  app.use(locationGroupRoutes)
  app.use(mapRoutes)

  // Start the Express server on a worker
  app.listen(PORT, () => {
    logger.info(`Worker process ${process.pid} running on port ${PORT}`)
  })
}
