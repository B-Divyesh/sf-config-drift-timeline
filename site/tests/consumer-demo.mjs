import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const consumer = mkdtempSync(join(tmpdir(), 'driftline-consumer-'));
const packageRoot = join(consumer, 'package');
const installRoot = join(consumer, 'installed');

try {
  execFileSync('cargo', ['package', '--allow-dirty'], { cwd: root, stdio: 'inherit' });
  const crate = join(root, 'target/package/config-drift-timeline-0.1.0.crate');
  mkdirSync(packageRoot);
  execFileSync('tar', ['-xf', crate, '-C', packageRoot], { stdio: 'inherit' });
  const unpacked = join(packageRoot, 'config-drift-timeline-0.1.0');
  execFileSync('cargo', ['install', '--debug', '--path', unpacked, '--root', installRoot], { stdio: 'inherit' });
  const binary = join(installRoot, 'bin/driftline');
  assert.equal(existsSync(binary), true, 'the packaged crate installs a driftline binary');
  const output = spawnSync(binary, ['demo'], { encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  const report = output.stdout.split('\n').find((line) => line.startsWith('Demo report: '))?.slice('Demo report: '.length);
  assert.ok(report, 'the installed demo prints a report location');
  const parsed = JSON.parse(readFileSync(report, 'utf8'));
  assert.equal(parsed.summary.unsafe_active, 3);
  assert.equal(parsed.active.some((entry) => entry.key === 'database.replica_count'), true);
  assert.doesNotMatch(readFileSync(report, 'utf8'), /example-staging-token/);
  rmSync(report.split('/').slice(0, -1).join('/'), { recursive: true, force: true });
  console.log('Consumer package: installed driftline demo produced a redacted report in a temporary workspace');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
