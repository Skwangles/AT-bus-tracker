import path from 'path'
import cors from 'cors'
import express from 'express'
import { PORT } from './consts'
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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
