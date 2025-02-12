import path from 'path'
import cors from 'cors'
import express from 'express'
import { PORT, SKIP_IF_MAP_ALREADY_CONFIGED } from './consts'
import authoringRoutes from './routes/authoring.routes'
import imageRoutes from './routes/image.routes'
import mapRoutes from './routes/map.routes'
import labelRoutes from './routes/labels.routes'

import logger from './logger'
import bodyParser from 'body-parser'
import initData from './logic/initData'

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.static(path.join(__dirname, '../authoring/dist')))

app.use(bodyParser.urlencoded({ extended: false, limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));

// render browser
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '../authoring/dist', 'index.html'))
})

app.use(mapRoutes)
app.use(imageRoutes)
app.use(authoringRoutes)
app.use(labelRoutes)

app.listen(PORT, () => {
  initData(SKIP_IF_MAP_ALREADY_CONFIGED)
  logger.info(`Server running on port ${PORT}`)
})
