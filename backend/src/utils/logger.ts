import winston from "winston";
import path from "path";
import fs from "fs";

const createLogDirectory = () => {
    const today = new Date().toISOString().split('T')[0];
    const rootDir = path.resolve(__dirname, '../..');
    const logDir = path.join(rootDir, 'logs', today);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, {
            recursive: true
        })
    }
    return logDir;
}

const logDir = createLogDirectory();

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
    ]
})
