import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { logger } from "./utils/logger";
import { handleError } from "./utils/error";
import { mainRouts } from "./routes";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use("/api/v1", mainRouts);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  handleError(err, req, res);
});

const port = process.env.PORT || 3000;

app.listen(port, async () => {
  // await generateMockPosts(50)
  console.log(`Server is running on port ${port}`);
});
