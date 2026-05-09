const upload = require('../middleware/upload');

describe('upload file allowlist', () => {
  it('accepts CSV and XLSX files with expected MIME types', () => {
    expect(upload.isAllowedUpload('players.csv', 'text/csv')).toBe(true);
    expect(upload.isAllowedUpload('players.csv', 'application/vnd.ms-excel')).toBe(true);
    expect(upload.isAllowedUpload('players.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  it('accepts octet-stream only for CSV and XLSX extensions', () => {
    expect(upload.isAllowedUpload('players.csv', 'application/octet-stream')).toBe(true);
    expect(upload.isAllowedUpload('players.xlsx', 'application/octet-stream')).toBe(true);
    expect(upload.isAllowedUpload('malware.exe', 'application/octet-stream')).toBe(false);
  });

  it('rejects mismatched or unsupported MIME/extension combinations', () => {
    expect(upload.isAllowedUpload('players.csv', 'application/pdf')).toBe(false);
    expect(upload.isAllowedUpload('players.xlsx', 'text/csv')).toBe(false);
    expect(upload.isAllowedUpload('players.txt', 'text/csv')).toBe(false);
  });
});
