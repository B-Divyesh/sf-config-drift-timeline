import { spawnSync } from 'node:child_process';

const grep = process.argv.find((argument) => argument.startsWith('--grep='))?.slice('--grep='.length);
const args = ['--test'];
if (grep) args.push(`--test-name-pattern=${grep}`);
args.push('site/tests/claims.mjs');
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
