// src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const uploadDir = path.join(__dirname, "../../uploads/temp");
const reportsDir = path.join(__dirname, "../../uploads/reports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Configure storage for CSV files
const csvStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "csv-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Configure storage for report images
const reportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, reportsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "report-" + uniqueSuffix + ext);
  },
});

// CSV File filter
const csvFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/csv",
  ];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || ext === ".csv") {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed"), false);
  }
};

// Image File filter for reports
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/webp",
  ];
  const ext = path.extname(file.originalname).toLowerCase();

  if (
    allowedTypes.includes(file.mimetype) ||
    [".jpg", ".jpeg", ".png", ".heic", ".webp"].includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, HEIC, and WEBP images are allowed"), false);
  }
};

// Configure multer for CSV uploads
const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Configure multer for report images
const uploadReportImage = multer({
  storage: reportStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Generic upload for single file (for backward compatibility)
const upload = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Clean up old temp files (optional utility)
const cleanupTempFiles = () => {
  // Clean CSV temp files
  const files = fs.readdirSync(uploadDir);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  files.forEach((file) => {
    const filePath = path.join(uploadDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Error cleaning up ${file}:`, err);
    }
  });

  // Clean report images older than 7 days
  const reportFiles = fs.readdirSync(reportsDir);
  const reportMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  reportFiles.forEach((file) => {
    const filePath = path.join(reportsDir, file);
    try {
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > reportMaxAge) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Error cleaning up report ${file}:`, err);
    }
  });
};

// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Run initial cleanup
cleanupTempFiles();

module.exports = {
  upload, // For CSV uploads (bulk upload)
  uploadCSV, // Explicit CSV upload
  uploadReportImage, // For report images
  uploadDir,
  reportsDir,
  cleanupTempFiles,
};
