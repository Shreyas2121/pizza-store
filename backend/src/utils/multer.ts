import multer from "multer";
import path from "path";
import { AppError } from "./error";
import { uploadsDirectory } from "./storage-paths";
import { usesCloudinary } from "./cloudinary-storage";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDirectory()),
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

export const upload = multer({
  storage: usesCloudinary() ? multer.memoryStorage() : storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/avif",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Invalid file type. Only images are allowed.", 400));
    }
  },
});
