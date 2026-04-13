/**
 * upload.js
 * Multer configuration for CSV and XLSX file uploads.
 * Files are held in memory (never written to disk).
 * Enforces 5 MB limit and MIME/extension allowlist.
 */

const multer = require('multer');

const ALLOWED_MIMES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some OS/browsers mis-type CSV/XLSX
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    const name = (file.originalname || '').toLowerCase();
    const isCsvOrXlsx = name.endsWith('.csv') || name.endsWith('.xlsx');
    if (ALLOWED_MIMES.has(file.mimetype) || isCsvOrXlsx) {
      return cb(null, true);
    }
    cb(new Error('Only CSV and XLSX files are accepted'));
  },
});

module.exports = upload;
