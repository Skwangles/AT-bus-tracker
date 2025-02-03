import path from 'path'
import cors from 'cors'
import express from 'express'
import initData from './logic/initData'
import { SKIP_IF_MAP_ALREADY_CONFIGED, PORT } from './consts'
import authoringRoutes from './routes/authoring.routes'
import pointsRoutes from './routes/points.routes'
import imageRoutes from './routes/image.routes'
import locationGroupRoutes from './routes/locationGroups.routes'
import mapRoutes from './routes/map.routes'
import logger from './logger'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../ui/dist')))

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../ui/dist', 'index.html'))
})

app.use(pointsRoutes)
app.use(imageRoutes)
app.use(locationGroupRoutes)
app.use(mapRoutes)
app.use(authoringRoutes)

app.listen(PORT, () => {
  initData(SKIP_IF_MAP_ALREADY_CONFIGED)
  logger.info(`Server running on port ${PORT}`)
})
