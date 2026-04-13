/**
 * export-formatters.js
 * Shared formatting utilities for CSV and XLSX exports.
 */

/**
 * Escape a single value for CSV output.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Convert an array of values into a CSV row string (no trailing newline).
 */
function csvRow(values) {
  return values.map(csvEscape).join(',');
}

/**
 * Format a YYYY-MM-DD date string to MM/DD/YYYY (SportsEngine format).
 */
function formatDateSE(isoDate) {
  if (!isoDate) return '';
  const s = String(isoDate).slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * Format shot value for SportsEngine (L → Left, R → Right).
 */
function formatShotSE(shot) {
  if (shot === 'L') return 'Left';
  if (shot === 'R') return 'Right';
  return '';
}

/**
 * Format gender for SportsEngine (M → male, F → female).
 */
function formatGenderSE(gender) {
  if (gender === 'M') return 'male';
  if (gender === 'F') return 'female';
  return '';
}

/**
 * Sanitize a string for use in a filename (remove non-alphanumeric except dash/dot).
 */
function safeFilename(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = { csvRow, formatDateSE, formatShotSE, formatGenderSE, safeFilename };
