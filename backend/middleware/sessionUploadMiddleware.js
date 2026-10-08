const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Local development storage. Replace this adapter with S3/object storage for deployment.
const UPLOAD_ROOT = path.resolve(__dirname, "../uploads");
const SESSION_UPLOAD_ROOT = path.join(UPLOAD_ROOT, "sessions");

const allowedExtensions = {
  screenVideo: ".mp4",
  audio: ".wav",
  motionLog: ".json",
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const sessionDirectory = path.join(SESSION_UPLOAD_ROOT, req.params.sessionId);

    fs.mkdir(sessionDirectory, { recursive: true }, (error) => {
      callback(error, sessionDirectory);
    });
  },
  filename: (req, file, callback) => {
    // Use server-controlled names; never use an uploaded filename as a disk path.
    const filenames = {
      screenVideo: "screen.mp4",
      audio: "audio.wav",
      motionLog: "motion.json",
    };

    callback(null, filenames[file.fieldname]);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 3,
    fileSize: 150 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    const expectedExtension = allowedExtensions[file.fieldname];
    const actualExtension = path.extname(file.originalname).toLowerCase();

    if (!expectedExtension || actualExtension !== expectedExtension) {
      const error = new Error("Each upload field must contain its expected file type");
      error.status = 400;
      error.code = "INVALID_FILE_TYPE";
      return callback(error);
    }

    return callback(null, true);
  },
}).fields([
  { name: "screenVideo", maxCount: 1 },
  { name: "audio", maxCount: 1 },
  { name: "motionLog", maxCount: 1 },
]);

// Convert Multer parser errors into clear client responses.
const uploadSessionFiles = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();

    const isMulterError = error instanceof multer.MulterError;
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : (error.status || 400);

    return res.status(status).json({
      error: {
        code: isMulterError ? error.code : (error.code || "UPLOAD_ERROR"),
        message: error.code === "LIMIT_FILE_SIZE"
          ? "An uploaded file exceeds the 150 MB limit"
          : error.message,
      },
    });
  });
};

module.exports = {
  UPLOAD_ROOT,
  uploadSessionFiles,
};
