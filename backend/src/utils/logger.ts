import winston from "winston";
import path from "path";
import fs from "fs";

const createLogDirectory = () => {
  const today = new Date().toISOString().split("T")[0];
  const rootDir = path.resolve(__dirname, "../..");
  const logDir = path.join(rootDir, "logs", today);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, {
      recursive: true,
    });
  }
  return logDir;
};

const logDir = createLogDirectory();

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaKeys = Object.keys(meta);
    const metaStr =
      metaKeys.length > 0 ? ` | ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: fileFormat,
    }),
  ],
});
