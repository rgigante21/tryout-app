#!/usr/bin/env node
/**
 * audit-tenancy.js
 *
 * Static CI checker for multi-tenant query scoping.
 *
 * Scans backend route, middleware, and util files. For every pool.query /
 * client.query call that references a Class 1 table (tables with a direct
 * organization_id column), it verifies that the query string also contains
 * "organization_id". Exits non-zero if any unscoped queries are found.
 *
 * Escape hatch: add a comment containing "tenant-global:" on the same line
 * as or immediately before the query call to suppress the warning.
 *
 * Usage:
 *   node scripts/audit-tenancy.js
 *   node scripts/audit-tenancy.js --verbose
 */

const fs   = require('fs');
const path = require('path');

const VERBOSE = process.argv.includes('--verbose');

// Class 1 tables — direct organization_id ownership
const CLASS1_TABLES = [
  'users',
  'tryout_events',
  'age_groups',
  'sessions',
  'players',
  'evaluation_templates',
  'audit_log',
];

// Directories to scan (relative to repo root)
const SCAN_DIRS = [
  'backend/routes',
  'backend/middleware',
  'backend/utils',
];

// File extensions to scan
const EXTENSIONS = ['.js'];

// Regex to find query calls: pool.query(...) or client.query(...)
// Captures the opening of the call; we extract the full template/string that follows
const QUERY_CALL_RE = /(?:pool|client)\.query\s*\(/g;

// Match a template literal or string argument following the opening paren
// We extract enough content to check for table names and org scoping
const BACKTICK_RE   = /`([\s\S]*?)`/;
const SINGLEQUOTE_RE = /'([^']*)'/;
const DOUBLEQUOTE_RE = /"([^"]*)"/;

function extractQueryString(src, offset) {
  // Advance past whitespace and optional leading newlines
  const slice = src.slice(offset);
  const btMatch = slice.match(/^[\s\n]*`([\s\S]*?)`/);
  if (btMatch) return btMatch[1];
  const sqMatch = slice.match(/^[\s\n]*'([^']*)'/);
  if (sqMatch) return sqMatch[1];
  const dqMatch = slice.match(/^[\s\n]*"([^"]*)"/);
  if (dqMatch) return dqMatch[1];
  return null;
}

function lineNumber(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

function hasTenantGlobalComment(src, offset) {
  // Look for "tenant-global:" in the 3 lines before the query call
  const before = src.slice(Math.max(0, offset - 300), offset);
  const lines = before.split('\n');
  const last3 = lines.slice(-3).join('\n');
  return last3.includes('tenant-global:');
}

function scanFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  let match;
  QUERY_CALL_RE.lastIndex = 0;

  while ((match = QUERY_CALL_RE.exec(src)) !== null) {
    const callOffset = match.index;
    const afterParen = callOffset + match[0].length;
    const queryStr = extractQueryString(src, afterParen);

    if (!queryStr) continue;

    const upper = queryStr.toUpperCase();

    // Check if query touches any Class 1 table
    const touchedTables = CLASS1_TABLES.filter(t => {
      const tu = t.toUpperCase();
      // Match table name as a word (FROM table, JOIN table, UPDATE table, INTO table, ON table)
      return new RegExp(`(?:FROM|JOIN|UPDATE|INTO|ON)\\s+${tu}(?:\\s|$|,|\\.)`, 'i').test(queryStr);
    });

    if (touchedTables.length === 0) continue;

    // If it has organization_id, it's scoped — OK
    if (queryStr.includes('organization_id')) continue;

    // If it has a tenant-global escape comment — OK
    if (hasTenantGlobalComment(src, callOffset)) continue;

    const line = lineNumber(src, callOffset);
    issues.push({
      file: filePath,
      line,
      tables: touchedTables,
      snippet: queryStr.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  }

  return issues;
}

function collectFiles(dirs) {
  const repoRoot = path.join(__dirname, '..');
  const files = [];

  for (const dir of dirs) {
    const absDir = path.join(repoRoot, dir);
    if (!fs.existsSync(absDir)) continue;

    for (const entry of fs.readdirSync(absDir)) {
      if (EXTENSIONS.includes(path.extname(entry))) {
        files.push(path.join(absDir, entry));
      }
    }
  }

  return files;
}

function main() {
  const files = collectFiles(SCAN_DIRS);
  const allIssues = [];

  for (const file of files) {
    const issues = scanFile(file);
    allIssues.push(...issues);
  }

  if (allIssues.length === 0) {
    console.log(`✓ audit-tenancy: all ${files.length} files pass — no unscoped Class 1 queries found`);
    process.exit(0);
  }

  console.error(`\n✗ audit-tenancy: found ${allIssues.length} unscoped query(ies) in ${files.length} files\n`);

  for (const issue of allIssues) {
    const rel = path.relative(path.join(__dirname, '..'), issue.file);
    console.error(`  ${rel}:${issue.line} — tables: [${issue.tables.join(', ')}]`);
    if (VERBOSE) {
      console.error(`    SQL: ${issue.snippet}`);
    }
  }

  console.error(`
Each query touching a Class 1 tenant-owned table must include organization_id
in the WHERE/INSERT/UPDATE clause. To suppress for intentional global queries
(e.g. scheduler, migrations), add a comment containing "tenant-global: <reason>"
on the line before or the same line as the query call.
`);

  process.exit(1);
}

main();
