/* Audit form controls for missing id or name.
   Scans HUD sources under src/msd/hud and (optionally) legacy src/hud.
   Flags <input>, <select>, <textarea> (excluding type="hidden").
   Exit code: 0 = all good, 1 = issues found.
*/
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(ROOT, 'src', 'msd', 'hud'),
  path.join(ROOT, 'src', 'hud') // legacy (ignored if absent)
].filter(fs.existsSync);

const EXTS = new Set(['.js', '.ts', '.mjs', '.cjs', '.html']);

// Multiline-safe tag capture
const CONTROL_RE = /<\s*(input|select|textarea)\b[^>]*?>/gims;

const results = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (EXTS.has(path.extname(entry))) scanFile(full);
  }
}

function scanFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  let match;
  while ((match = CONTROL_RE.exec(text)) !== null) {
    const raw = match[0];
    // Skip hidden inputs
    if (/type\s*=\s*["']hidden["']/i.test(raw)) continue;
    // Allow explicit opt-out
    if (/\bdata-ignore-autofill\b/i.test(raw)) continue;

    const hasId = /\bid\s*=\s*["'][^"']+["']/i.test(raw);
    const hasName = /\bname\s*=\s*["'][^"']+["']/i.test(raw);
    if (!hasId || !hasName) {
      results.push({
        file,
        line: lineOf(text, match.index),
        tag: match[1].toLowerCase(),
        hasId,
        hasName,
        snippet: raw.replace(/\s+/g, ' ').slice(0, 140)
      });
    }
  }
}

function lineOf(text, idx) {
  // Count lines up to index
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

// Execute scan
SCAN_DIRS.forEach(walk);

if (results.length === 0) {
  console.log(`✅ All detected form controls have both id and name (scanned: ${SCAN_DIRS.map(d => path.relative(ROOT, d)).join(', ')})`);
  process.exit(0);
}

console.log(`⚠ Found ${results.length} form control(s) missing id or name:\n`);
results.forEach(r => {
  console.log(`${path.relative(ROOT, r.file)}:${r.line} <${r.tag}> Missing:${!r.hasId ? ' id' : ''}${!r.hasName ? ' name' : ''}`);
  console.log(`  ${r.snippet}`);
  console.log('');
});

console.log('Suggestion: Add id="hud-[panel]-[field]" name="hud-[panel]-[field]"');
console.log('You may also add autocomplete tokens if appropriate (e.g., autocomplete="off" only if necessary).');

process.exit(1);
