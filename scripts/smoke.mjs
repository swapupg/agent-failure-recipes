import { createHash } from 'node:crypto';
const base = process.env.BASE_URL;
const expected = process.env.EXPECTED_COMMIT;
if (!base || !expected || !/^https:\/\//.test(base)) throw new Error('Set HTTPS BASE_URL and EXPECTED_COMMIT');
const fetchFile = async path => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const info = JSON.parse((await fetchFile('build-info.json')).toString());
if (info.commit !== expected) throw new Error(`Wrong deployment: expected ${expected}, got ${info.commit}`);
const manifest = JSON.parse((await fetchFile('release-manifest.json')).toString());
if (manifest.commit !== expected) throw new Error('Manifest revision mismatch');
for (const [path, digest] of Object.entries(manifest.sha256)) {
  if (createHash('sha256').update(await fetchFile(path)).digest('hex') !== digest) throw new Error(`Artifact mismatch: ${path}`);
}
console.log(`Verified HTTPS deployment ${expected}: ${Object.keys(manifest.sha256).length} artifact hashes match.`);
