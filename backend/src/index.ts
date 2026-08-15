import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { logger } from "./utils/logger";
import { handleError } from "./utils/error";
import { mainRoutes } from "./routes";
import { Server } from "socket.io";
import http from "http";
import { env } from "./utils/zodSchema";

const app = express();
const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: env.FE_URL,
  },
});

io.on("connection", (socket) => {
  logger.info(`A client connected: ${socket.id}`);

  // Example: joinRoom event
  socket.on("joinRoom", ({ userId }) => {
    socket.join(`user-${userId}`);
    logger.info(`Socket ${socket.id} joined room user-${userId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: env.FE_URL, credentials: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use("/api/v1", mainRoutes);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  handleError(err, req, res);
});

const port = process.env.PORT || 3000;

app.set("io", io);

httpServer.listen(port, async () => {
  // await generateMockPosts(50)
  console.log(`Server is running on port ${port}`);
});
