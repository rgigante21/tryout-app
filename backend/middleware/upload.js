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

function isAllowedUpload(name, mime) {
  const lower = (name || '').toLowerCase();
  const isCsv = lower.endsWith('.csv');
  const isXlsx = lower.endsWith('.xlsx');
  if (!isCsv && !isXlsx) return false;

  if (mime === 'application/octet-stream') return true;
  if (isCsv) return mime === 'text/csv' || mime === 'application/vnd.ms-excel';
  return mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIMES.has(file.mimetype) && isAllowedUpload(file.originalname, file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only CSV and XLSX files are accepted'));
  },
});

module.exports = upload;
module.exports.isAllowedUpload = isAllowedUpload;
