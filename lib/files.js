const fs = require('node:fs');
const path = require('node:path');

// Query parameters have already been decoded by URLSearchParams. Never decode
// a plain filesystem path again: '%' and '%20' can be literal filename text.
function normalizeFilePath(raw) {
  if (typeof raw !== 'string' || !raw || raw.includes('\0')) return '';
  let value = raw;
  if (/^file:/i.test(value)) {
    const url = new URL(value);
    value = decodeURIComponent(url.pathname);
    if (process.platform === 'win32') {
      if (url.hostname && url.hostname !== 'localhost') value = `\\\\${url.hostname}${value}`;
      else value = value.replace(/^\/([a-z]:)/i, '$1');
    } else if (url.hostname && url.hostname !== 'localhost') {
      throw new Error('Remote file URLs are not supported on this platform');
    }
  }
  return process.platform === 'win32' ? value.replace(/\//g, '\\') : value;
}

function resolveDocument(raw) {
  const file = normalizeFilePath(raw);
  if (!file || !path.isAbsolute(file)) throw Object.assign(new Error('An absolute document path is required'), { status: 400 });
  if (!/\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(file)) {
    throw Object.assign(new Error('Unsupported document format'), { status: 415 });
  }
  // Resolve exactly this path; never substitute a different file with the same name.
  const real = fs.realpathSync(file);
  if (!fs.statSync(real).isFile()) throw Object.assign(new Error('The document path is not a file'), { status: 400 });
  return real;
}

module.exports = { normalizeFilePath, resolveDocument };
