import { format } from "path";
import winston from "winston";

const logger = winston.createLogger({
  transports: [
    // Docker logs and normal developer view


    // Just errors
    new winston.transports.File({ filename: 'error.log', level: 'error' }),

    // All logs
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
  )
}

export default logger