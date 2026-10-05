import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
let commit = process.env.GITHUB_SHA || 'local-uncommitted';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* First local build before Git initialization. */ }
writeFileSync('web-dist/build-info.json', JSON.stringify({ version: '0.1.0', commit, recipeRevision: 1 }, null, 2));
const files = [];
function walk(dir) { for (const file of readdirSync(dir).sort()) { const path = `${dir}/${file}`; if (statSync(path).isDirectory()) walk(path); else files.push(path); } }
walk('web-dist');
const bytes = files.filter(file => file.endsWith('.js')).reduce((total, file) => total + gzipSync(readFileSync(file)).length, 0);
if (bytes > 100 * 1024) throw new Error(`JavaScript budget exceeded: ${bytes} compressed bytes`);
const hashes = Object.fromEntries(files.map(file => [file.replace('web-dist/', ''), createHash('sha256').update(readFileSync(file)).digest('hex')]));
writeFileSync('web-dist/release-manifest.json', JSON.stringify({ commit, version: '0.1.0', javascriptGzipBytes: bytes, sha256: hashes }, null, 2));
console.log(`Static release: ${commit}; JavaScript ${bytes} gzip bytes; ${files.length} files hashed.`);
