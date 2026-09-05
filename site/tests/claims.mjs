import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('../..', import.meta.url).pathname;
const cli = (args, extraEnv = {}) => {
  const result = spawnSync('cargo', ['run', '--quiet', '--', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
};

const demoPaths = (stdout) => {
  const value = (prefix) => stdout.split('\n').find((line) => line.startsWith(prefix))?.slice(prefix.length);
  const workspace = value('Sample workspace: ');
  const report = value('Demo report: ');
  assert.ok(workspace, 'the demo prints its isolated temporary workspace');
  assert.ok(report, 'the demo prints its report location');
  return { workspace, report, ledger: `${workspace}/timeline.json` };
};

const removeDemo = ({ workspace }) => rmSync(workspace, { recursive: true, force: true });

let preview;
let browser;
let baseUrl;

const reservePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    probe.close((error) => error ? reject(error) : resolve(address.port));
  });
});

before(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  preview = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', 'preview', '--config', 'site/vite.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit' });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  preview?.kill('SIGTERM');
});

test('@claim:raw-values-redacted bundled sample ledger and report contain fingerprints, not raw values', () => {
  const paths = demoPaths(cli(['demo']));
  try {
    const ledger = readFileSync(paths.ledger, 'utf8');
    const report = readFileSync(paths.report, 'utf8');
    assert.match(ledger, /sha256:/);
    assert.match(report, /"state": "secret"/);
    assert.doesNotMatch(`${ledger}\n${report}`, /example-(staging|production)-token/);
  } finally { removeDemo(paths); }
});

test('@claim:dotenv-yaml-json bundled sample accepts dotenv, YAML, and JSON layers', () => {
  const paths = demoPaths(cli(['demo']));
  try {
    const ledger = JSON.parse(readFileSync(paths.ledger, 'utf8'));
    const sourceExtensions = new Set(ledger.snapshots.flatMap((snapshot) => snapshot.sources.map((source) => source.split('.').pop())));
    assert.deepEqual(sourceExtensions, new Set(['yaml', 'env', 'json']));
    assert.equal(ledger.snapshots.length, 2);
  } finally { removeDemo(paths); }
});

test('@claim:cli-no-telemetry demo completes without contacting a configured proxy', async () => {
  let proxyUsed = false;
  const proxy = createServer(() => { proxyUsed = true; });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  const proxyUrl = `http://127.0.0.1:${address.port}`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn('cargo', ['run', '--quiet', '--', 'demo'], { cwd: root, env: { ...process.env, HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, ALL_PROXY: proxyUrl } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  await new Promise((resolve) => proxy.close(resolve));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(proxyUsed, false, 'the CLI must not send telemetry through the configured proxy');
  removeDemo(demoPaths(result.stdout));
});

test('@claim:local-only-snapshots demo writes only to a new temporary workspace', () => {
  const before = readFileSync(new URL('../../examples/staging.yaml', import.meta.url), 'utf8');
  const paths = demoPaths(cli(['demo']));
  try {
    assert.ok(paths.workspace.startsWith('/tmp/'));
    assert.equal(existsSync(`${root}/.drift/timeline.json`), false);
    assert.equal(readFileSync(new URL('../../examples/staging.yaml', import.meta.url), 'utf8'), before);
  } finally { removeDemo(paths); }
});

test('@claim:null-absent-overridden bundled sample report distinguishes null, absent, and overridden states', () => {
  const paths = demoPaths(cli(['demo']));
  try {
    const report = JSON.parse(readFileSync(paths.report, 'utf8'));
    const ledger = JSON.parse(readFileSync(paths.ledger, 'utf8'));
    assert.equal(report.active.some((entry) => Object.values(entry.sides).some((side) => side.state === 'null')), true);
    assert.equal(report.active.some((entry) => Object.values(entry.sides).some((side) => side.state === 'absent')), true);
    assert.equal(ledger.snapshots.every((snapshot) => snapshot.values['http.port'].overridden), true);
  } finally { removeDemo(paths); }
});

test('@claim:first-introduction bundled sample names the first observed actor and environment', () => {
  const paths = demoPaths(cli(['demo']));
  try {
    const report = JSON.parse(readFileSync(paths.report, 'utf8'));
    const replicaDrift = report.active.find((entry) => entry.key === 'database.replica_count');
    assert.deepEqual(
      { at: replicaDrift.first_observed_at, actor: replicaDrift.introduced_by, environment: replicaDrift.introduced_in },
      { at: '2026-08-28T10:42:00Z', actor: 'priya', environment: 'production' }
    );
  } finally { removeDemo(paths); }
});

test('@claim:demo-isolated browser sample uses only a demo storage key and resets', async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('sb_license:config-drift-timeline', 'real-license-must-not-change'));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/demo/`, { waitUntil: 'networkidle' });
  await page.getByText('Demo — sample data, nothing is saved').waitFor();
  await page.getByRole('button', { name: 'Next' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('sb_license:config-drift-timeline')), 'real-license-must-not-change');
  assert.equal(await page.evaluate(() => localStorage.getItem('demo:config-drift-timeline:step')), '1');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByText('Capture 1 of 4').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('demo:config-drift-timeline:step')), null);
  await context.close();
});

test('@claim:offline-reload sample remains available offline after its first visit', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/demo/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Find the first sample configuration difference.' }).waitFor();
  await context.close();
});

test('@claim:free-cli-json core CLI JSON output and CI exit code work without a license', () => {
  const paths = demoPaths(cli(['demo']));
  try {
    const result = spawnSync('cargo', ['run', '--quiet', '--', 'report', '--ledger', paths.ledger, '--compare', 'staging,production', '--format', 'json', '--fail-on-drift'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.unsafe_active, 3);
    assert.ok(report.active.length >= 3);
  } finally { removeDemo(paths); }
});

test('@claim:pro-one-time-price product page states the optional pack price and one-time terms', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Buy Pro incident pack — $39' }).waitFor();
  assert.match(await page.locator('#pro').innerText(), /One-time purchase/);
  assert.match(await page.locator('#pro').innerText(), /\$39/);
  await context.close();
});

test('@claim:offline-cached-license a previously verified license unlocks the pack offline', async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('sb_license:config-drift-timeline', 'verified-token');
    localStorage.setItem('sb_license_verdict:config-drift-timeline', JSON.stringify({ token: 'verified-token', valid: true, reason: 'ok', checkedAt: Date.now() }));
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Download Pro incident pack' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Download Pro incident pack' }).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Pro unlocked offline using the last verified license.').waitFor();
  await context.close();
});

test('@claim:license-token-only verification request contains only the license token', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  let verifyRequest;
  await page.route('https://api.sociobot.in/api/v1/products/config-drift-timeline/verify?license=*', async (route) => {
    verifyRequest = route.request();
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ valid: false, reason: 'invalid' }) });
  });
  await page.goto(`${baseUrl}/?license=only-this-token`, { waitUntil: 'networkidle' });
  await page.getByText('License no longer active').waitFor();
  const url = new URL(verifyRequest.url());
  assert.deepEqual([...url.searchParams.keys()], ['license']);
  assert.equal(url.searchParams.get('license'), 'only-this-token');
  assert.equal(verifyRequest.method(), 'GET');
  assert.equal(verifyRequest.postData(), null);
  await context.close();
});

test('@claim:browser-only-license-storage returned licenses stay in scoped browser storage', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('https://api.sociobot.in/api/v1/products/config-drift-timeline/verify?license=*', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ valid: false, reason: 'invalid' }) }));
  await page.goto(`${baseUrl}/?license=browser-only-token`, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => localStorage.getItem('sb_license:config-drift-timeline')), 'browser-only-token');
  assert.equal((await context.cookies()).length, 0);
  assert.equal(page.url().includes('license='), false);
  await context.close();
});

test('@claim:refund-revocation revoked licenses no longer unlock the incident pack', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('https://api.sociobot.in/api/v1/products/config-drift-timeline/verify?license=*', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ valid: false, reason: 'revoked' }) }));
  await page.goto(`${baseUrl}/?license=revoked-token`, { waitUntil: 'networkidle' });
  await page.getByText('License no longer active (revoked).').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download Pro incident pack' }).isVisible(), false);
  await context.close();
});

test('@claim:first-party-site normal sample load requests only this product origin', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const origins = new Set();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto(`${baseUrl}/demo/`, { waitUntil: 'networkidle' });
  assert.deepEqual([...origins], [baseUrl]);
  await context.close();
});
