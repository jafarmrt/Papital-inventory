import winston from 'winston';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

const { combine, timestamp, printf, colorize } = winston.format;

// Define custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const isProduction = process.env.NODE_ENV === 'production';

// Initialize transports with Console by default
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(colorize(), logFormat)
  })
];

// Add file transports only in development environment
if (!isProduction) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    transports.push(
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    );
  } catch (err) {
    console.error('Failed to initialize file logging, falling back to console only:', err);
  }
}

// Create Winston Logger
export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports
});

// Setup Morgan to use Winston
const stream = {
  write: (message: string) => logger.http(message.trim())
};

export const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream }
);

// Global Error Handler Middleware
export const errorHandler = (err: any, req: any, res: any, next: any) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
};
