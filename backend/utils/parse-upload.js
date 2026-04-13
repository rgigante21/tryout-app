/**
 * parse-upload.js
 * Converts a multer file buffer (CSV or XLSX) into a uniform row array.
 * Returns: { rows: Record<string, string>[], warnings: string[] }
 *
 * Header normalization: lowercase, non-alphanumeric → underscore, trim leading/trailing underscores.
 * This matches the existing parseCSV behavior in the old import.js.
 */

function normalizeHeader(h) {
  return h.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function splitCSVLine(line) {
  const values = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function parseCSVBuffer(buffer) {
  // Strip BOM if present (Excel "Save as CSV" adds \uFEFF)
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0].split(',').map(normalizeHeader);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    rows.push(row);
  }

  return rows;
}

function parseXLSXBuffer(buffer) {
  let xlsx;
  try {
    xlsx = require('xlsx');
  } catch {
    throw new Error('XLSX support requires the "xlsx" package — run: npm install xlsx');
  }

  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch (err) {
    if (err.message && err.message.toLowerCase().includes('password')) {
      throw new Error('File could not be read — if the XLSX is password-protected, remove the password before uploading');
    }
    throw new Error('Could not parse XLSX file — ensure it is a valid Excel spreadsheet');
  }

  const warnings = [];
  if (workbook.SheetNames.length > 1) {
    warnings.push(`XLSX contains ${workbook.SheetNames.length} sheets — only the first sheet ("${workbook.SheetNames[0]}") was imported`);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!raw || raw.length < 2) throw new Error('XLSX file has no data rows');

  const headers = raw[0].map(h => normalizeHeader(String(h)));
  const rows = [];

  for (let i = 1; i < raw.length; i++) {
    const rawRow = raw[i];
    // Skip fully empty rows
    if (rawRow.every(v => v === '' || v === null || v === undefined)) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = String(rawRow[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return { rows, warnings };
}

/**
 * parseUpload(file) — main export
 * file: multer file object with { buffer, originalname, mimetype }
 * Returns: { rows: Record<string, string>[], warnings: string[] }
 */
function parseUpload(file) {
  const name = (file.originalname || '').toLowerCase();
  const isXLSX = name.endsWith('.xlsx') ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (isXLSX) {
    return parseXLSXBuffer(file.buffer);
  }

  const rows = parseCSVBuffer(file.buffer);
  return { rows, warnings: [] };
}

module.exports = { parseUpload, splitCSVLine, normalizeHeader };
