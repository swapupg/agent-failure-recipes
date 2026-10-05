import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
const directory = mkdtempSync(`${tmpdir()}/afr-package-`);
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', directory], { encoding: 'utf8' }))[0];
  writeFileSync(`${directory}/package.json`, '{"type":"module","private":true}');
  execFileSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', resolve(directory, packed.filename)], { cwd: directory, stdio: 'pipe' });
  execFileSync(process.execPath, ['--input-type=module', '-e', `import {runRecipe} from 'agent-failure-recipes'; const result=await runRecipe('duplicate-action','repaired'); if(!result.check.passed) throw new Error('Package export failed');`], { cwd: directory, stdio: 'inherit' });
  const cli = `${directory}/node_modules/agent-failure-recipes/dist/cli.js`;
  for (const [args, status] of [[[], 0], [['duplicate-action', '--variant', 'broken'], 1], [['unknown'], 2], [['--variant', 'repaired', '--json'], 0]]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    if (result.status !== status) throw new Error(`CLI ${args.join(' ')} expected ${status}: ${result.stderr}`);
    if (args.includes('--json') && JSON.parse(result.stdout).length !== 3) throw new Error('Invalid JSON output');
  }
  console.log('Packed install, exports and CLI exit codes verified in a clean temporary project.');
} finally { rmSync(directory, { recursive: true, force: true }); }
